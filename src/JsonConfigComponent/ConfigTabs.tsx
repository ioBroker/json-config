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
    },
    panel: {
        width: '100%',
        display: 'block',
    },
    panelWithIcons: {
        height: 'calc(100% - 72px)',
    },
    panelWithoutIcons: {
        height: 'calc(100% - 48px)',
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

    private readonly refDiv: React.RefObject<HTMLDivElement>;

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
        this.refDiv = React.createRef();

        Object.assign(this.state, { tab, useMenu: false, openMenu: null, tabErrors: {} });
    }

    onTabError = (attr?: string, error?: string): void => {
        const currentTab = this.state.tab;
        if (!currentTab && attr) {
            // Forward to parent if no current tab
            this.props.onError(attr, error);
            return;
        }

        const newTabErrors = { ...this.state.tabErrors };

        if (currentTab) {
            newTabErrors[currentTab] ||= {};
        }

        if (currentTab && attr) {
            if (!error) {
                delete newTabErrors[currentTab][attr];
                // Clean up empty tab error objects
                if (Object.keys(newTabErrors[currentTab]).length === 0) {
                    delete newTabErrors[currentTab];
                }
            } else {
                newTabErrors[currentTab][attr] = error;
            }
        }

        this.setState({ tabErrors: newTabErrors });

        // Also forward to parent
        this.props.onError(attr, error);
    };

    hasTabErrors = (tabName: string): boolean => {
        return !!this.state.tabErrors[tabName] && Object.keys(this.state.tabErrors[tabName]).length > 0;
    };

    async componentDidMount(): Promise<void> {
        await super.componentDidMount();
        // Measure the real width synchronously so the first painted frame already
        // uses the correct breakpoint (no visible tabs -> menu switch).
        this.measureWidth();
        // Keep the width up to date on later layout changes (dialog open animation,
        // async detail loading, window/dialog resize) instead of freezing a
        // transient - possibly too narrow - initial measurement.
        if (this.refDiv.current && typeof ResizeObserver !== 'undefined') {
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
            this.resizeObserver.observe(this.refDiv.current);
        }
    }

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

    updateCalculatedValuesForTable(): void {
        if (this.calculateTimeoutTable) {
            clearTimeout(this.calculateTimeoutTable);
        }
        this.calculateTimeoutTable = setTimeout(async (): Promise<void> => {
            this.calculateTimeoutTable = null;
            const items = this.props.schema.items;
            const calculatedValuesTable: Record<string, { hidden: boolean; disabled: boolean }> = {};
            for (const name in items) {
                let disabled: boolean;
                if (items[name].expertMode && !this.props.expertMode) {
                    calculatedValuesTable[name] = { hidden: true, disabled: false };
                    continue;
                }

                if (this.props.custom) {
                    const hidden = !!(await this.executeCustom(
                        items[name].hidden,
                        this.props.data,
                        this.props.customObj,
                        this.props.oContext.instanceObj,
                        this.props.index,
                        this.props.globalData,
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
                    ));
                    calculatedValuesTable[name] = { hidden, disabled };
                } else {
                    const hidden = !!(await this.execute(
                        items[name].hidden,
                        false,
                        this.props.data,
                        this.props.index,
                        this.props.globalData,
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
                    label: this.getText(items[name].label),
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
                    style={this.props.schema.tabsStyle}
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
                ref={this.refDiv}
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
                    style={{
                        ...styles.panel,
                        ...(withIcons ? styles.panelWithIcons : styles.panelWithoutIcons),
                    }}
                    common={this.props.common}
                    alive={this.props.alive}
                    themeName={this.props.themeName}
                    data={this.props.data}
                    originalData={this.props.originalData}
                    onChange={this.props.onChange}
                    onError={this.onTabError}
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
