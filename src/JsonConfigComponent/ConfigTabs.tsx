import React, { type JSX } from 'react';

import { Tabs, Tab, IconButton, Toolbar, Menu, MenuItem, ListItemIcon, Box } from '@mui/material';
import { Menu as MenuIcon, Error as ErrorIcon } from '@mui/icons-material';

import type { ConfigItemTabs } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
import ConfigPanel from './ConfigPanel';

const styles: Record<string, React.CSSProperties> = {
    tabs: {
        height: '100%',
        width: '100%',
        // The tab bar keeps its own height, and the panel takes all the rest.
        // Do not calculate the panel height with magic numbers, as the height of the tab bar
        // depends on the theme, on the icons and on the font size.
        display: 'flex',
        flexDirection: 'column',
    },
    tabsBar: {
        flex: '0 0 auto',
    },
    panel: {
        width: '100%',
        display: 'block',
        flex: '1 1 auto',
        // Allow the panel to be smaller than its content, so it can scroll itself
        minHeight: 0,
    },
};

interface ConfigTabsProps extends ConfigGenericProps {
    schema: ConfigItemTabs;
    dialogName?: string;
    withoutSaveButtons?: boolean;
}

interface ConfigTabsState extends ConfigGenericState {
    tab?: string;
    /** Show the burger menu instead of the tab bar (true only for very narrow widths). Decided with hysteresis. */
    useMenu: boolean;
    openMenu: HTMLButtonElement | null;
    tabErrors: Record<string, Record<string, string>>; // tab -> attr -> error
    calculatedValuesTable: Record<string, { hidden: boolean; disabled: boolean }> | null;
    /**
     * Width (px) reserved on the container while a tab switch is in progress, or undefined when
     * no switch is pending. Prevents the shrink-to-fit dialog from collapsing during the frame
     * where the freshly-mounted panel still renders no content. See pinWidthForTransition().
     */
    contentMinWidth?: number;
}

export default class ConfigTabs extends ConfigGeneric<ConfigTabsProps, ConfigTabsState> {
    /** Below this width the tabs collapse into a burger menu */
    private static readonly MENU_WIDTH = 600;
    /**
     * Dead-band around MENU_WIDTH. A scrollbar appearing/disappearing on a tab change shifts
     * clientWidth by ~15px; without this dead-band that would toggle bar<->menu and flicker.
     */
    private static readonly MENU_HYSTERESIS = 40;

    private resizeObserver: ResizeObserver | null = null;
    private resizeRaf: number | null = null;
    private calculateTimeoutTable: ReturnType<typeof setTimeout> | null = null;
    private pinTimeout: ReturnType<typeof setTimeout> | null = null;
    /**
     * Resolved `dependsOnStates` of the tabs: tab name => (alias => state ID).
     * The tab bar calculates `hidden`/`disabled` of the tabs itself, so it must subscribe to their states too.
     */
    private tabStateAliases: Record<string, Record<string, string>> = {};

    /** Filled by `onRefDiv`, not by React, because the observer has to be attached with it */
    private readonly refDiv: { current: HTMLDivElement | null } = { current: null };

    /** `onError` handler per tab, see `getTabErrorHandler` */
    private readonly tabErrorHandlers: Record<string, (attr?: string, error?: string) => void> = {};

    constructor(props: ConfigTabsProps) {
        super(props);
        let tab: string | undefined;

        if (this.props.root) {
            // read the path from hash
            // #tab-instances/config/system.adapter.ping.0/<TAB-NAME-OR-INDEX>
            const hash = (window.location.hash || '').replace(/^#/, '').split('/');
            if (hash.length >= 3 && hash[1] === 'config') {
                const tabS = hash[3];
                const tabN = parseInt(tabS, 10);
                if (tabS && tabN.toString() === tabS) {
                    if (tabN >= 0 && tabN < Object.keys(this.props.schema.items).length) {
                        tab = Object.keys(this.props.schema.items)[tabN];
                    }
                } else if (tabS && Object.keys(this.props.schema.items).includes(tabS)) {
                    tab = tabS;
                }

                // install on hash change handler
                window.addEventListener('hashchange', this.onHashTabsChanged, false);
            }
        }

        if (tab === undefined) {
            tab =
                (((window as any)._localStorage as Storage) || window.localStorage).getItem(
                    `${this.props.dialogName || 'App'}.${this.props.oContext.adapterName}`,
                ) || Object.keys(this.props.schema.items)[0];
            if (!Object.keys(this.props.schema.items).includes(tab)) {
                tab = Object.keys(this.props.schema.items)[0];
            }
        }
        Object.assign(this.state, { tab, useMenu: false, openMenu: null, tabErrors: {} });
    }

    /**
     * Error handler of one tab. The handlers are cached per tab, so the panel keeps the same
     * `onError` prop across renders.
     * The handler must be bound to the tab it was created for: the items report their errors from a
     * timer (see `ConfigGeneric.render`), so a report can arrive after the user has already switched
     * over. `this.state.tab` would then be the new tab, and the error marker would land on it.
     *
     * @param tabName the tab whose panel gets this handler
     */
    getTabErrorHandler(tabName: string): (attr?: string, error?: string) => void {
        this.tabErrorHandlers[tabName] ||= (attr?: string, error?: string): void =>
            this.onTabError(tabName, attr, error);

        return this.tabErrorHandlers[tabName];
    }

    onTabError(tabName: string, attr?: string, error?: string): void {
        if (attr) {
            this.setState(prevState => {
                // The state must be copied inside the updater: all items of one render pass report
                // their errors in the same batch, and a copy taken outside would be the same
                // outdated state for every one of them, so only the last report would survive
                const tabErrors = { ...prevState.tabErrors };
                const errors = { ...tabErrors[tabName] };

                if (error) {
                    errors[attr] = error;
                } else {
                    delete errors[attr];
                }

                if (Object.keys(errors).length) {
                    tabErrors[tabName] = errors;
                } else {
                    delete tabErrors[tabName];
                }

                return { tabErrors };
            });
        }

        // Also forward to parent
        this.props.onError(attr, error);
    }

    hasTabErrors = (tabName: string): boolean => {
        return Object.keys(this.state.tabErrors[tabName] || {}).length > 0;
    };

    async componentDidMount(): Promise<void> {
        await super.componentDidMount();
        // The container cannot be measured here: `render` returns null until the calculated values
        // of the tabs are ready, and those are computed asynchronously. The div therefore appears
        // only later, and `onRefDiv` takes over the measuring and the observing.
    }

    /**
     * Measure and observe the container as soon as it enters the DOM.
     *
     * This must not happen in `componentDidMount`: at that moment `render` has returned null,
     * because the calculated values of the tabs are not ready yet. The ref would be empty, the
     * observer would never be attached, and the width would never be measured - so the tabs would
     * stay in the bar and simply be cut off on a narrow display instead of collapsing into the
     * burger menu.
     *
     * @param node the container of the tab bar and the panel, or null when it is removed
     */
    onRefDiv = (node: HTMLDivElement | null): void => {
        if (this.refDiv.current === node) {
            return;
        }
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        this.refDiv.current = node;

        if (!node) {
            return;
        }

        // Measure the real width immediately so the first painted frame already
        // uses the correct breakpoint (no visible tabs -> menu switch).
        this.measureWidth();

        // Keep the width up to date on later layout changes (dialog open animation,
        // async detail loading, window/dialog resize) instead of freezing a
        // transient - possibly too narrow - initial measurement.
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => {
                // Coalesce bursts into a single measurement per frame. This also breaks the
                // ResizeObserver feedback loop: switching bar<->menu changes the layout, which
                // would otherwise notify the observer again immediately and cause flickering.
                if (this.resizeRaf !== null) {
                    return;
                }
                this.resizeRaf = window.requestAnimationFrame(() => {
                    this.resizeRaf = null;
                    this.measureWidth();
                });
            });
            this.resizeObserver.observe(node);
        }
    };

    componentWillUnmount(): void {
        if (this.resizeRaf !== null) {
            window.cancelAnimationFrame(this.resizeRaf);
            this.resizeRaf = null;
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        if (this.calculateTimeoutTable) {
            clearTimeout(this.calculateTimeoutTable);
            this.calculateTimeoutTable = null;
        }
        if (this.pinTimeout) {
            clearTimeout(this.pinTimeout);
            this.pinTimeout = null;
        }
        window.removeEventListener('hashchange', this.onHashTabsChanged, false);
        super.componentWillUnmount();
    }

    /**
     * Freeze the current container width for the duration of a tab switch. Switching tabs remounts
     * the panel (key={tab}), and a freshly-mounted ConfigPanel renders `null` for a frame or two
     * while it computes its calculated values. In that gap the widest content is just the tab bar,
     * so the shrink-to-fit dialog collapses and then grows back - the visible width "jump".
     *
     * We capture the width shown by the outgoing tab and apply it as a temporary minWidth floor, then
     * release it shortly after so genuine resizes (window/dialog) keep working normally afterwards.
     */
    private pinWidthForTransition(): void {
        const width = this.refDiv.current?.clientWidth;
        if (!width) {
            return;
        }
        if (this.pinTimeout) {
            clearTimeout(this.pinTimeout);
        }
        if (this.state.contentMinWidth !== width) {
            this.setState({ contentMinWidth: width });
        }
        this.pinTimeout = setTimeout(() => {
            this.pinTimeout = null;
            this.setState({ contentMinWidth: undefined });
        }, 500);
    }

    measureWidth = (): void => {
        const width = this.refDiv.current?.clientWidth;
        if (!width) {
            return;
        }
        // Decide with hysteresis whether to collapse the tabs into the burger menu. Switch to the
        // menu once the width drops below MENU_WIDTH, but only switch back to the tab bar once it
        // grows past MENU_WIDTH + MENU_HYSTERESIS. The dead-band in between prevents a scrollbar
        // that appears/disappears on a tab change (shifting the width by ~15px) from toggling the
        // layout back and forth, which is what caused the flickering.
        let useMenu = this.state.useMenu;
        if (!useMenu && width < ConfigTabs.MENU_WIDTH) {
            useMenu = true;
        } else if (useMenu && width > ConfigTabs.MENU_WIDTH + ConfigTabs.MENU_HYSTERESIS) {
            useMenu = false;
        }
        if (useMenu !== this.state.useMenu) {
            this.setState({ useMenu });
        }
    };

    onHashTabsChanged = (): void => {
        const hash = (window.location.hash || '').replace(/^#/, '').split('/');
        if (hash.length > 3 && hash[1] === 'config') {
            const tabS = hash[3];
            const tabN = parseInt(tabS, 10);
            let tab;
            if (tabN.toString() === tabS) {
                if (tabN >= 0 && tabN < Object.keys(this.props.schema.items).length) {
                    tab = Object.keys(this.props.schema.items)[tabN];
                }
            } else if (Object.keys(this.props.schema.items).includes(tabS)) {
                tab = tabS;
            }
            if (tab !== undefined && tab !== this.state.tab) {
                (((window as any)._localStorage as Storage) || window.localStorage).setItem(
                    `${this.props.dialogName || 'App'}.${this.props.oContext.adapterName}`,
                    tab,
                );
                this.pinWidthForTransition();
                this.setState({ tab });
            }
        }
    };

    onMenuChange(tab: string): void {
        (((window as any)._localStorage as Storage) || window.localStorage).setItem(
            `${this.props.dialogName || 'App'}.${this.props.oContext.adapterName}`,
            tab,
        );
        this.pinWidthForTransition();
        this.setState({ tab }, () => {
            if (this.props.root) {
                const hash = (window.location.hash || '').split('/');
                if (hash.length >= 3 && hash[1] === 'config') {
                    hash[3] = this.state.tab || '';
                    window.location.hash = hash.join('/');
                }
            }
        });
    }

    /** The tab bar depends on the states of all its tabs, because it calculates their `hidden`/`disabled` */
    protected usesDependsOnStates(): boolean {
        const items = this.props.schema.items;
        return super.usesDependsOnStates() || Object.keys(items || {}).some(name => !!items[name].dependsOnStates);
    }

    /** Subscribe on the own states and additionally on the states of all tabs */
    protected async updateStateSubscriptions(): Promise<void> {
        this.stateAliases = await this.resolveDependsOnStates(this.props.schema?.dependsOnStates);
        const ids: string[] = Object.values(this.stateAliases);

        const items = this.props.schema.items;
        const tabStateAliases: Record<string, Record<string, string>> = {};
        for (const name of Object.keys(items || {})) {
            if (items[name].dependsOnStates) {
                const aliases = await this.resolveDependsOnStates(items[name].dependsOnStates);
                tabStateAliases[name] = aliases;
                ids.push(...Object.values(aliases));
            }
        }
        this.tabStateAliases = tabStateAliases;

        await this.subscribeOnStateIds(ids);
    }

    updateCalculatedValuesForTable(): void {
        if (this.calculateTimeoutTable) {
            clearTimeout(this.calculateTimeoutTable);
        }
        this.calculateTimeoutTable = setTimeout(async (): Promise<void> => {
            this.calculateTimeoutTable = null;
            if (this.usesDependsOnStates()) {
                // Resolve the state IDs of the tabs and wait for their values
                await this.updateStateSubscriptions();
            }
            const items = this.props.schema.items;
            const calculatedValuesTable: Record<string, { hidden: boolean; disabled: boolean }> = {};
            for (const name in items) {
                let disabled: boolean;
                if (items[name].expertMode && !this.props.expertMode) {
                    calculatedValuesTable[name] = { hidden: true, disabled: false };
                    continue;
                }

                // Do not show the tab if it is not intended for the host, where the instance runs
                if (!ConfigGeneric.isHostAllowed(items[name], this.props.oContext.hostInfo)) {
                    calculatedValuesTable[name] = { hidden: true, disabled: false };
                    continue;
                }

                // Every tab is calculated with its own `dependsOnStates` values
                const states = this.getStateValues(this.tabStateAliases[name] || null);

                if (this.props.custom) {
                    const hidden = !!(await this.executeCustom(
                        items[name].hidden,
                        this.props.data,
                        this.props.customObj,
                        this.props.oContext.instanceObj,
                        this.props.index,
                        this.props.globalData,
                        'hidden',
                        states,
                    ));
                    if (hidden) {
                        calculatedValuesTable[name] = { hidden: true, disabled: false };
                        continue;
                    }
                    disabled = !!(await this.executeCustom(
                        items[name].disabled,
                        this.props.data,
                        this.props.customObj,
                        this.props.oContext.instanceObj,
                        this.props.index,
                        this.props.globalData,
                        'disabled',
                        states,
                    ));
                    calculatedValuesTable[name] = { hidden, disabled };
                } else {
                    const hidden = !!(await this.execute(
                        items[name].hidden,
                        false,
                        this.props.data,
                        this.props.index,
                        this.props.globalData,
                        'hidden',
                        states,
                    ));
                    if (hidden) {
                        calculatedValuesTable[name] = { hidden: true, disabled: false };
                        continue;
                    }
                    disabled = !!(await this.execute(
                        items[name].disabled,
                        false,
                        this.props.data,
                        this.props.index,
                        this.props.globalData,
                        'disabled',
                        states,
                    ));
                    calculatedValuesTable[name] = { hidden: false, disabled };
                }
            }

            if (JSON.stringify(calculatedValuesTable) !== JSON.stringify(this.state.calculatedValuesTable)) {
                this.setState({ calculatedValuesTable });
            }
        }, 50);
    }

    render(): JSX.Element | null {
        const items = this.props.schema.items;
        let withIcons = false;

        this.updateCalculatedValuesForTable();
        if (!this.state.calculatedValuesTable) {
            return null;
        }
        const elements: { icon: React.JSX.Element | null; label: string; name: string; disabled: boolean }[] = [];

        Object.keys(items)
            .filter(name => !this.state.calculatedValuesTable?.[name]?.hidden)
            .map(name => {
                const icon = this.getIcon(items[name].icon);
                withIcons ||= !!icon;
                elements.push({
                    icon,
                    disabled: !!this.state.calculatedValuesTable?.[name]?.disabled,
                    label: this.getText(
                        items[name].label,
                        undefined,
                        this.getStateValues(this.tabStateAliases[name] || null),
                    ),
                    name,
                });
            });

        if (!elements.find(item => item.name === this.state.tab)) {
            // Select the first tab if the current tab is not available
            setTimeout(() => this.setState({ tab: elements[0].name }), 50);
        }

        let tabs: React.JSX.Element;
        if (this.state.useMenu && elements.length > 2) {
            tabs = (
                <Toolbar
                    style={{
                        ...styles.tabsBar,
                        top: 2,
                        backgroundColor: this.props.oContext.themeType === 'dark' ? '#222' : '#DDD',
                    }}
                    variant="dense"
                >
                    <IconButton
                        onClick={(event: React.MouseEvent<HTMLButtonElement>) =>
                            this.setState({ openMenu: event.currentTarget })
                        }
                    >
                        <MenuIcon />
                    </IconButton>
                    {this.state.openMenu ? (
                        <Menu
                            open={!0}
                            anchorEl={this.state.openMenu}
                            onClose={() => this.setState({ openMenu: null })}
                        >
                            {elements.map(el => {
                                const hasErrors = this.hasTabErrors(el.name);
                                return (
                                    <MenuItem
                                        disabled={el.disabled}
                                        key={el.name}
                                        onClick={() => {
                                            this.setState({ openMenu: null }, () => this.onMenuChange(el.name));
                                        }}
                                        selected={el.name === this.state.tab}
                                        sx={hasErrors ? { color: 'error.main' } : undefined}
                                    >
                                        {withIcons ? <ListItemIcon>{el.icon}</ListItemIcon> : null}
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%' }}>
                                            {el.label}
                                            {hasErrors && <ErrorIcon sx={{ fontSize: 16, color: 'error.main' }} />}
                                        </Box>
                                    </MenuItem>
                                );
                            })}
                        </Menu>
                    ) : null}
                </Toolbar>
            );
        } else {
            tabs = (
                <Tabs
                    variant="scrollable"
                    scrollButtons="auto"
                    // Without this, MUI hides the scroll buttons below its `sm` breakpoint, and on a
                    // small display the tabs at the end cannot be reached at all
                    allowScrollButtonsMobile
                    style={{ ...styles.tabsBar, ...this.props.schema.tabsStyle }}
                    value={this.state.tab}
                    onChange={(_e, tab: string): void => this.onMenuChange(tab)}
                >
                    {elements.map(el => {
                        const hasErrors = this.hasTabErrors(el.name);
                        const label = hasErrors ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {el.label}
                                <ErrorIcon sx={{ fontSize: 16, color: 'error.main' }} />
                            </Box>
                        ) : (
                            el.label
                        );

                        return (
                            <Tab
                                id={el.name}
                                wrapped
                                disabled={el.disabled}
                                key={el.name}
                                value={el.name}
                                iconPosition={this.props.schema.iconPosition || 'start'}
                                icon={el.icon || undefined}
                                label={label}
                                sx={hasErrors ? { '& .MuiTab-wrapper': { color: 'error.main' } } : undefined}
                            />
                        );
                    })}
                </Tabs>
            );
        }
        if (!this.state.tab) {
            return null;
        }
        return (
            <div
                style={
                    this.state.contentMinWidth !== undefined
                        ? { ...styles.tabs, minWidth: this.state.contentMinWidth }
                        : styles.tabs
                }
                ref={this.onRefDiv}
            >
                {tabs}
                <ConfigPanel
                    oContext={this.props.oContext}
                    withoutSaveButtons={this.props.withoutSaveButtons}
                    isParentTab
                    changed={this.props.changed}
                    key={this.state.tab}
                    expertMode={this.props.expertMode}
                    index={1001}
                    arrayIndex={this.props.arrayIndex}
                    globalData={this.props.globalData}
                    commandRunning={this.props.commandRunning}
                    style={styles.panel}
                    common={this.props.common}
                    alive={this.props.alive}
                    themeName={this.props.themeName}
                    data={this.props.data}
                    originalData={this.props.originalData}
                    onChange={this.props.onChange}
                    onError={this.getTabErrorHandler(this.state.tab)}
                    customObj={this.props.customObj}
                    custom={this.props.custom}
                    schema={items[this.state.tab]}
                    table={this.props.table}
                    withIcons={withIcons}
                    customComponents={this.props.customComponents}
                />
            </div>
        );
    }
}
