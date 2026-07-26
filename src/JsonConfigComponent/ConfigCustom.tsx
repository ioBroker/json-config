import React, { type JSX } from 'react';
import { LinearProgress } from '@mui/material';
import { registerRemotes, loadRemote, init } from '@module-federation/runtime';

import { I18n, InfoBox } from '@iobroker/gui-components';

import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
import ConfigCustomErrorBoundary from './ConfigCustomErrorBoundary';
import { checkGuiApiCompatibility, GUI_API_GENERATION, type GuiApiVerdict } from './guiApiGate';
import type { ConfigItemCustom } from '../types';

interface ConfigCustomProps extends ConfigGenericProps {
    schema: ConfigItemCustom;
}

interface ConfigCustomState extends ConfigGenericState {
    Component: React.FC<ConfigGenericProps> | null;
    error: string;
    /** Set when the component was refused by the GUI API gate, so it was never loaded */
    incompatible: GuiApiVerdict | null;
}

// Only create the federation instance so that `registerRemotes`/`loadRemote` below have one.
//
// Do NOT declare shared modules here. The host already registers them from its own federation
// config, with the real version and `singleton: true`. Re-registering a subset under the pseudo
// version '*' and without `singleton` put a SECOND entry for the same package into the share scope
// (observable as `['*', '10.0.3']` for '@iobroker/gui-components'), which let a custom component
// resolve to its own bundled fallback copy instead of the host's module. For `I18n` - whose
// dictionary lives in static class fields - that meant `ConfigCustom` filled one instance while the
// component read from another, so custom components rendered raw keys like `custom_easy_Instance`.
//
// That the host's registration is the operative one is evident from `react`, `react-dom` and
// `@mui/material`: they were never registered here and resolve correctly.
init({
    name: 'iobroker_admin',
    shared: {},
    remotes: [],
});

export default class ConfigCustom extends ConfigGeneric<ConfigCustomProps, ConfigCustomState> {
    static runningLoads: Record<string, Promise<{ default: Record<string, React.FC<ConfigGenericProps>> } | null>> = {};

    constructor(props: ConfigCustomProps) {
        super(props);
        // schema.url - location of Widget
        // schema.name - Component name
        // schema.i18n - i18n

        Object.assign(this.state, {
            Component: null,
            error: '',
            incompatible: null,
        });
    }

    // load component dynamically
    async componentDidMount(): Promise<void> {
        if (!this.props.schema.url) {
            console.error('URL is empty. Cannot load custom component!');
            this.setState({ error: 'URL is empty. Cannot load custom component!' });
            return;
        }

        let url;
        if (this.props.schema.url.startsWith('http:') || this.props.schema.url.startsWith('https:')) {
            url = this.props.schema.url;
        } else if (this.props.schema.url.startsWith('./')) {
            url = `${window.location.protocol}//${window.location.host}${this.props.schema.url.replace(/^\./, '')}`;
        } else {
            url = `${window.location.protocol}//${window.location.host}/adapter/${this.props.oContext.adapterName}/${this.props.schema.url}`;
        }
        const [uniqueName, fileToLoad, ...componentNameParts] = this.props.schema.name.split('/');
        const componentName = componentNameParts.join('/');
        if (!url) {
            console.error(
                'Cannot find URL for custom component! Please define "url" as "custom/customComponents.js" in the schema',
            );
            return;
        }
        if (!uniqueName || !fileToLoad || !componentName) {
            console.error(
                'Invalid format of "name"! Please define "name" as "ConfigCustomBackItUpSet/Components/AdapterExist" in the schema',
            );
            return;
        }

        // Refuse an incompatible component before it is registered: it shares this admin's React and
        // MUI singletons, so one built against another generation would break while rendering.
        const verdict = await checkGuiApiCompatibility(url, this.props.schema.guiApi);
        if (!verdict.compatible) {
            console.warn(
                `Custom component "${this.props.schema.name}" from "${url}" was not started: it targets ` +
                    `GUI API generation ${verdict.declared}, but this admin provides generation ${GUI_API_GENERATION}.`,
            );
            this.setState({ incompatible: verdict });
            return;
        }

        let setPromise: Promise<{ default: Record<string, React.FC<ConfigGenericProps>> } | null> | undefined =
            ConfigCustom.runningLoads[`${url}!${fileToLoad}`];

        if (!(setPromise instanceof Promise)) {
            let i18nPromise: Promise<void> | undefined;
            if (this.props.schema.i18n === true) {
                // load i18n from files
                const pos = url.lastIndexOf('/');
                let i18nURL: string;
                if (pos !== -1) {
                    i18nURL = url.substring(0, pos);
                } else {
                    i18nURL = url;
                }
                const lang = I18n.getLanguage();
                const file = `${i18nURL}/i18n/${lang}.json`;

                i18nPromise = fetch(file)
                    .then(data => data.json())
                    .then(json => I18n.extendTranslations(json, lang))
                    .catch(error => {
                        if (lang !== 'en') {
                            // try to load English
                            fetch(`${i18nURL}/i18n/en.json`)
                                .then(data => data.json())
                                .then(json => I18n.extendTranslations(json, lang))
                                .catch(err => console.log(`Cannot load i18n "${file}": ${err}`));
                            return;
                        }
                        console.log(`Cannot load i18n "${file}": ${error}`);
                    });
            } else if (this.props.schema.i18n && typeof this.props.schema.i18n === 'object') {
                try {
                    I18n.extendTranslations(this.props.schema.i18n);
                } catch (error) {
                    console.error(`Cannot import i18n: ${error}`);
                }
            }
            try {
                console.log(url, uniqueName, fileToLoad, componentName);

                registerRemotes(
                    [
                        {
                            name: uniqueName,
                            entry: url,
                            // Components of the current GUI API generation are always built as ES
                            // modules, so the former `bundlerType` schema attribute is obsolete.
                            type: 'module',
                        },
                    ],
                    // force: true // may be needed to side-load remotes after the fact.
                );
                setPromise = loadRemote(`${uniqueName}/${fileToLoad}`);
                if (i18nPromise instanceof Promise) {
                    setPromise = Promise.all([setPromise, i18nPromise]).then(result => result[0]);
                }
                // remember promise
                ConfigCustom.runningLoads[`${url}!${fileToLoad}`] = setPromise;
            } catch (error) {
                console.error(error);
                this.setState({ error: `Cannot import from ${this.props.schema.url}: ${error}` });
            }
        }
        try {
            const component: Record<string, React.FC<ConfigGenericProps>> | undefined = (await setPromise)?.default;

            if (!component?.[componentName]) {
                const keys = Object.keys(component || {});
                console.error('URL is empty. Cannot load custom component!');
                this.setState({
                    error: `Component ${this.props.schema.name} not found in ${this.props.schema.url}. Found: ${keys.join(', ')}`,
                });
            } else {
                this.setState({ Component: component[componentName] });
            }
        } catch (error) {
            console.error(error);
            this.setState({ error: `Cannot import from ${this.props.schema.url}: ${error}` });
        }
    }

    /** Explain why a component was not started, and what the user can do about it */
    renderIncompatible(verdict: GuiApiVerdict): JSX.Element {
        return (
            <InfoBox
                type="warning"
                iconPosition="top"
            >
                <div>
                    <div style={{ fontWeight: 'bold' }}>
                        {I18n.t('jc_Custom component "%s" was not started', this.props.schema.name)}
                    </div>
                    <div>
                        {verdict.tooNew
                            ? I18n.t(
                                  'jc_It requires GUI API generation %s, but this admin provides generation %s. Please update the admin.',
                                  verdict.declared,
                                  GUI_API_GENERATION,
                              )
                            : I18n.t(
                                  'jc_It was built for GUI API generation %s, but this admin provides generation %s. Please update the adapter.',
                                  verdict.declared,
                                  GUI_API_GENERATION,
                              )}
                    </div>
                </div>
            </InfoBox>
        );
    }

    render(): JSX.Element {
        const CustomComponent: React.FC<ConfigGenericProps> | null = this.state.Component;
        const schema = this.props.schema || ({} as ConfigItemCustom);

        const item = CustomComponent ? (
            // The custom component is third-party code, so a render error must not take down the
            // whole configuration page with it.
            <ConfigCustomErrorBoundary
                name={schema.name}
                url={schema.url}
            >
                <CustomComponent
                    {...this.props}
                    // @ts-expect-error BF (2024-12-18) Remove after the 7.4 will be mainstream. All following lines
                    socket={this.props.oContext.socket}
                    theme={this.props.oContext.theme}
                    themeType={this.props.oContext.themeType}
                    instance={this.props.oContext.instance}
                    adapterName={this.props.oContext.adapterName}
                    systemConfig={this.props.oContext.systemConfig}
                    forceUpdate={this.props.oContext.forceUpdate}
                />
            </ConfigCustomErrorBoundary>
        ) : this.state.incompatible ? (
            this.renderIncompatible(this.state.incompatible)
        ) : this.state.error ? (
            <div>{this.state.error}</div>
        ) : (
            <LinearProgress />
        );

        if (schema.newLine) {
            return (
                <>
                    <div style={{ flexBasis: '100%', height: 0 }} />
                    {item}
                </>
            );
        }

        return item;
    }
}
