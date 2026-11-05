import React, { type JSX } from 'react';
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormHelperText,
    IconButton,
    InputLabel,
    LinearProgress,
} from '@mui/material';
import { Check as CheckIcon, Close as CloseIcon } from '@mui/icons-material';
import {
    CHANGE_EVENT,
    DIALOG_CLOSE_EVENT,
    getDefaultSettings,
    getPanelSettingTypes,
    getSettingTypes,
    getText,
    getWebComponentTheme,
    importWebComponent,
    isFormDialog,
    loadWebComponent,
    toSettings,
    type LoadedWebComponent,
    type WebComponentDialogRequest,
    type WebComponentDialogs,
    type WebComponentElement,
    type WebComponentElementDialog,
    type WebComponentSettings,
    type WebComponentTheme,
} from '@iobroker/web-components';

import { I18n, InfoBox, type IobTheme } from '@iobroker/gui-components';

import type { ConfigItemCustom, ConfigItemPanel } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
import ConfigPanel from './ConfigPanel';

/** Height of the element if neither the schema nor the manifest gives one, in px */
const DEFAULT_HEIGHT = 200;

interface OpenDialog {
    request: WebComponentDialogRequest;
    resolve: (result: unknown) => void;
    /** The values of a form dialog while the user edits them */
    values: Record<string, any>;
}

interface ConfigWebComponentProps extends ConfigGenericProps {
    schema: ConfigItemCustom;
}

interface ConfigWebComponentState extends ConfigGenericState {
    /** Set when the manifest was read and the module defines the element */
    component: LoadedWebComponent | null;
    error: string;
    dialog: OpenDialog | null;
}

/**
 * A custom element of `@iobroker/web-components` as an item of the configuration: `type: "custom"` with
 * `webComponent`. The element gets `socket`, `settings`, `theme` and `dialogs` as in every host, and the value of its
 * attribute as `value`, which it changes with the event `iob-change` - the values of the contract.
 */
export default class ConfigWebComponent extends ConfigGeneric<ConfigWebComponentProps, ConfigWebComponentState> {
    /** The manifests by URL: every row of a table shows the same component */
    private static readonly loads = new Map<string, Promise<LoadedWebComponent>>();

    private element: WebComponentElement | null = null;

    private container: HTMLDivElement | null = null;

    private dialogContainer: HTMLDivElement | null = null;

    /** What the element got last, so that it gets a new object on a change only */
    private lastSettings = '';

    private lastValue: string | undefined;

    private lastTheme: { source: IobTheme; theme: WebComponentTheme } | null = null;

    private themeGiven: WebComponentTheme | null = null;

    private unmounted = false;

    private readonly dialogs: WebComponentDialogs = {
        open: (request: WebComponentDialogRequest): Promise<unknown> => this.openDialog(request),
    };

    constructor(props: ConfigWebComponentProps) {
        super(props);
        Object.assign(this.state, { component: null, error: '', dialog: null });
    }

    async componentDidMount(): Promise<void> {
        const loading = this.loadComponent();
        await super.componentDidMount();
        await loading;
    }

    componentDidUpdate(): void {
        this.syncElement();
    }

    componentWillUnmount(): void {
        super.componentWillUnmount();
        this.unmounted = true;
        this.state.dialog?.resolve(null);
        if (this.element) {
            this.element.removeEventListener(CHANGE_EVENT, this.onElementChange);
            this.element.remove();
            this.element = null;
        }
    }

    /** The manifest file as an absolute URL - resolved like `url` of a custom component */
    private getManifestUrl(): string {
        const file = this.props.schema.webComponent || '';
        if (/^https?:\/\//.test(file)) {
            return file;
        }
        const root = `${window.location.protocol}//${window.location.host}`;
        if (file.startsWith('./')) {
            return `${root}${file.substring(1)}`;
        }
        return `${root}/adapter/${this.props.oContext.adapterName}/${file}`;
    }

    /** Read the manifest and import the module, so that the element is defined */
    private async loadComponent(): Promise<void> {
        if (!this.props.schema.webComponent) {
            return;
        }
        const url = this.getManifestUrl();
        let promise = ConfigWebComponent.loads.get(url);
        if (!promise) {
            promise = (async (): Promise<LoadedWebComponent> => {
                let problem = '';
                const component = await loadWebComponent(
                    { url, adapter: this.props.oContext.adapterName, version: '' },
                    {
                        log: {
                            error: (text: string): void => {
                                problem = text;
                                console.error(text);
                            },
                            warn: (text: string): void => console.warn(text),
                        },
                    },
                );
                if (!component) {
                    throw new Error(problem || `Cannot load web component ${url}`);
                }
                await importWebComponent(component);
                return component;
            })();
            ConfigWebComponent.loads.set(url, promise);
            // a failed load is tried again the next time the item is shown
            promise.catch(() => ConfigWebComponent.loads.delete(url));
        }

        try {
            const component = await promise;
            if (!this.unmounted) {
                this.setState({ component, error: '' });
            }
        } catch (error) {
            if (!this.unmounted) {
                this.setState({
                    error: I18n.t(
                        'jc_Cannot load web component %s: %s',
                        this.props.schema.webComponent,
                        (error as Error)?.message || String(error),
                    ),
                });
            }
        }
    }

    /** The values of the settings: the defaults of the manifest, then the ones of the schema */
    private getSettings(component: LoadedWebComponent): WebComponentSettings {
        const values: Record<string, unknown> = getDefaultSettings(component.manifest);
        for (const [name, value] of Object.entries(this.props.schema.settings || {})) {
            values[name] =
                typeof value === 'string' && value.includes('${') ? this.getPattern(value, undefined, true) : value;
        }
        return toSettings(getSettingTypes(component.manifest), values);
    }

    /** The theme of the configuration as the element takes it - the same object as long as the theme stays */
    private getTheme(): WebComponentTheme {
        const source = this.props.oContext.theme;
        if (this.lastTheme?.source !== source) {
            this.lastTheme = { source, theme: getWebComponentTheme(source) };
        }
        return this.lastTheme.theme;
    }

    /** Create the element once it is defined, put it into its box and give it what changed */
    private syncElement(): void {
        const component = this.state.component;
        if (!component || !this.container) {
            return;
        }
        if (!this.element) {
            this.element = document.createElement(component.manifest.tag);
            this.element.style.position = 'absolute';
            this.element.style.inset = '0';
            this.element.addEventListener(CHANGE_EVENT, this.onElementChange);
        }
        const element = this.element;

        if (element.socket !== this.props.oContext.socket) {
            element.socket = this.props.oContext.socket;
        }
        // not compared with `element.theme`: the base class gives back a completed copy of it
        const theme = this.getTheme();
        if (theme !== this.themeGiven) {
            this.themeGiven = theme;
            element.theme = theme;
        }
        if (element.dialogs !== this.dialogs) {
            element.dialogs = this.dialogs;
        }

        const settings = this.getSettings(component);
        const settingsJson = JSON.stringify(settings);
        if (settingsJson !== this.lastSettings) {
            this.lastSettings = settingsJson;
            element.settings = settings;
        }

        if (this.props.attr) {
            const value = ConfigGeneric.getValue(this.props.data, this.props.attr);
            // the configuration is copied on every change, so the value is compared, not the object
            const valueJson = JSON.stringify(value);
            if (valueJson !== this.lastValue) {
                this.lastValue = valueJson;
                element.value = value;
            }
        }

        // after the properties: a component without the base class may expect them when it is connected
        if (element.parentNode !== this.container) {
            this.container.appendChild(element);
        }
    }

    private setContainer = (container: HTMLDivElement | null): void => {
        this.container = container;
        // a hidden item gives up its box; the element waits outside the document until it is shown again
        this.syncElement();
    };

    private isDisabled(): boolean {
        return !!(this.state.calculatedValues?.disabled || this.props.commandRunning || this.props.disabled);
    }

    private onElementChange = (event: Event): void => {
        if (!this.props.attr || this.isDisabled()) {
            return;
        }
        event.preventDefault();
        const value = (event as CustomEvent).detail;
        this.lastValue = JSON.stringify(value);
        void this.onChange(this.props.attr, value);
    };

    private openDialog(request: WebComponentDialogRequest): Promise<unknown> {
        return new Promise<unknown>(resolve => {
            if (this.unmounted || this.isDisabled()) {
                resolve(null);
                return;
            }
            // only one dialog at a time: a new request cancels the open one
            this.state.dialog?.resolve(null);

            const values: Record<string, any> = {};
            if (isFormDialog(request)) {
                for (const [name, setting] of Object.entries(request.form.items || {})) {
                    if (setting?.default !== undefined) {
                        values[name] = setting.default;
                    }
                }
                Object.assign(values, request.data);
            }
            this.setState({ dialog: { request, resolve, values } });
        });
    }

    private closeDialog(result: unknown): void {
        const dialog = this.state.dialog;
        if (dialog) {
            dialog.resolve(result ?? null);
            this.setState({ dialog: null });
        }
    }

    private onDialogClose = (event: Event): void => {
        event.stopPropagation();
        this.closeDialog((event as CustomEvent).detail);
    };

    /** The content of an element dialog: the element of the component, moved into the dialog */
    private setDialogContainer = (container: HTMLDivElement | null): void => {
        if (this.dialogContainer) {
            this.dialogContainer.removeEventListener(DIALOG_CLOSE_EVENT, this.onDialogClose);
            this.dialogContainer.replaceChildren();
        }
        this.dialogContainer = container;
        const request = this.state.dialog?.request as WebComponentElementDialog | undefined;
        if (container && request?.element) {
            container.addEventListener(DIALOG_CLOSE_EVENT, this.onDialogClose);
            container.appendChild(request.element);
        }
    };

    /** A text of the component: a string or `{ en, de, ... }` - not a key of the translations of JSON-Config */
    private static text(text: ioBroker.StringOrTranslated | undefined): string {
        return getText(text, I18n.getLanguage());
    }

    private renderDialog(): JSX.Element | null {
        const dialog = this.state.dialog;
        if (!dialog) {
            return null;
        }
        const { request } = dialog;
        const paperStyle: React.CSSProperties = {
            width: request.width ? `min(${request.width}px, 100%)` : undefined,
            maxWidth: request.width ? 'calc(100% - 32px)' : undefined,
        };
        const title = ConfigWebComponent.text(request.title);

        if (isFormDialog(request)) {
            return (
                <Dialog
                    open
                    maxWidth={request.width ? false : 'sm'}
                    fullWidth={!request.width}
                    onClose={() => this.closeDialog(null)}
                    slotProps={{ paper: { style: paperStyle } }}
                >
                    {title ? <DialogTitle>{title}</DialogTitle> : null}
                    <DialogContent style={{ height: request.height, paddingTop: title ? undefined : 16 }}>
                        <ConfigPanel
                            oContext={this.props.oContext}
                            alive={this.props.alive}
                            changed={false}
                            common={this.props.common}
                            expertMode={this.props.expertMode}
                            themeName={this.props.themeName}
                            data={dialog.values}
                            originalData={dialog.values}
                            schema={request.form as unknown as ConfigItemPanel}
                            onChange={(
                                attrOrData: string | Record<string, any> | undefined,
                                value?: any,
                                cb?: () => void,
                            ): void => {
                                const current = this.state.dialog;
                                if (!current) {
                                    cb?.();
                                    return;
                                }
                                const values: Record<string, any> = JSON.parse(JSON.stringify(current.values));
                                if (typeof attrOrData === 'string') {
                                    ConfigGeneric.setValue(values, attrOrData, value);
                                } else {
                                    Object.assign(values, attrOrData);
                                }
                                this.setState({ dialog: { ...current, values } }, cb);
                            }}
                            onError={() => {}}
                            customComponents={this.props.customComponents}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<CheckIcon />}
                            onClick={() =>
                                this.closeDialog(toSettings(getPanelSettingTypes(request.form), dialog.values))
                            }
                        >
                            {ConfigWebComponent.text(request.ok) || I18n.t('jc_Ok')}
                        </Button>
                        <Button
                            variant="contained"
                            color="grey"
                            startIcon={<CloseIcon />}
                            onClick={() => this.closeDialog(null)}
                        >
                            {ConfigWebComponent.text(request.cancel) || I18n.t('jc_Cancel')}
                        </Button>
                    </DialogActions>
                </Dialog>
            );
        }

        return (
            <Dialog
                open
                maxWidth={false}
                onClose={() => this.closeDialog(null)}
                slotProps={{ paper: { style: paperStyle } }}
            >
                <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 8 }}>
                    <span style={{ flexGrow: 1 }}>{title}</span>
                    <IconButton
                        size="small"
                        title={I18n.t('jc_Close')}
                        onClick={() => this.closeDialog(null)}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent>
                    <div
                        ref={this.setDialogContainer}
                        style={{
                            width: request.width ? '100%' : undefined,
                            height: request.height ? `min(${request.height}px, calc(100vh - 160px))` : undefined,
                        }}
                    />
                </DialogContent>
            </Dialog>
        );
    }

    renderItem(error: unknown, disabled: boolean): JSX.Element {
        const schema = this.props.schema;
        const size = this.state.component?.manifest.size;
        const height = schema.height ?? size?.height ?? DEFAULT_HEIGHT;
        const label = this.getText(schema.label, schema.noTranslation);

        let content: JSX.Element | null = null;
        if (!schema.webComponent) {
            content = <div>{I18n.t('jc_URL is empty. Cannot load custom component!')}</div>;
        } else if (this.state.error) {
            content = <InfoBox type="error">{this.state.error}</InfoBox>;
        } else if (!this.state.component) {
            content = <LinearProgress />;
        }

        return (
            <div style={{ width: '100%' }}>
                {label ? <InputLabel shrink>{label}</InputLabel> : null}
                {content || (
                    // The element is put in here by `syncElement` - React must not render anything into this box
                    <div
                        ref={this.setContainer}
                        inert={disabled}
                        style={{
                            position: 'relative',
                            width: size?.noResize ? size.width : '100%',
                            maxWidth: '100%',
                            height,
                            opacity: disabled ? 0.5 : 1,
                            outline: error ? `1px solid ${this.props.oContext.theme.palette.error.main}` : undefined,
                        }}
                    />
                )}
                {schema.help || this.getValidatorErrorText() ? (
                    <FormHelperText error={!!this.getValidatorErrorText()}>
                        {this.renderHelp(schema.help, schema.helpLink, schema.noTranslation)}
                    </FormHelperText>
                ) : null}
                {this.renderDialog()}
            </div>
        );
    }
}
