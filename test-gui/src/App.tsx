import React, { Component } from 'react';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';
import { Box, IconButton, MenuItem, Select, Tab, Tabs } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import {
    AdminConnection,
    I18n,
    IconExpert,
    Loader,
    PROGRESS,
    Theme,
    ToggleThemeMenu,
    type IobTheme,
    type ThemeName,
} from '@iobroker/gui-components';

import langEn from '@iobroker/gui-components/i18n/en.json';
import langDe from '@iobroker/gui-components/i18n/de.json';
import langRu from '@iobroker/gui-components/i18n/ru.json';
import langPt from '@iobroker/gui-components/i18n/pt.json';
import langNl from '@iobroker/gui-components/i18n/nl.json';
import langFr from '@iobroker/gui-components/i18n/fr.json';
import langIt from '@iobroker/gui-components/i18n/it.json';
import langEs from '@iobroker/gui-components/i18n/es.json';
import langPl from '@iobroker/gui-components/i18n/pl.json';
import langUk from '@iobroker/gui-components/i18n/uk.json';
import langZhCn from '@iobroker/gui-components/i18n/zh-cn.json';
import '@iobroker/gui-components/index.css';

import { JsonConfigComponent } from '../../src';
import type { ConfigItemTabs } from '../../src/types';

import demoSchema from './jsonConfig.json';

const LANGUAGES: ioBroker.Languages[] = ['en', 'de', 'ru', 'pt', 'nl', 'fr', 'it', 'es', 'pl', 'uk', 'zh-cn'];

/** The instance the JsonConfig is rendered for. `admin.0` always exists, so sendTo items have a target. */
const ADAPTER_NAME = 'admin';
const INSTANCE = 0;

type AppTab = 'config' | 'data' | 'schema';

interface AppState {
    connected: boolean;
    loaded: boolean;
    tab: AppTab;
    theme: IobTheme;
    themeName: ThemeName;
    expertMode: boolean;
    language: ioBroker.Languages;
    /** The data, which are edited by the JsonConfigComponent */
    data: Record<string, any>;
    /** Incremented to force the JsonConfigComponent to re-read the data */
    updateData: number;
    error: boolean;
    changed: boolean;
}

export default class App extends Component<object, AppState> {
    private readonly socket: AdminConnection;

    constructor(props: object) {
        super(props);

        const translations: Record<ioBroker.Languages, Record<string, string>> = {
            en: langEn,
            de: langDe,
            ru: langRu,
            pt: langPt,
            nl: langNl,
            fr: langFr,
            it: langIt,
            es: langEs,
            pl: langPl,
            uk: langUk,
            'zh-cn': langZhCn,
        };

        const themeName = (window.localStorage.getItem('json-config-test-theme') as ThemeName) || 'dark';
        const language = (window.localStorage.getItem('json-config-test-lang') as ioBroker.Languages) || 'en';

        this.state = {
            connected: false,
            loaded: false,
            tab: (window.localStorage.getItem('json-config-test-tab') as AppTab) || 'config',
            theme: Theme(themeName),
            themeName,
            expertMode: window.localStorage.getItem('json-config-test-expert') === 'true',
            language,
            data: JSON.parse(window.localStorage.getItem('json-config-test-data') || '{}'),
            updateData: 0,
            error: false,
            changed: false,
        };

        I18n.setTranslations(translations);
        I18n.setLanguage(language);

        this.socket = new AdminConnection({
            protocol: 'http:',
            host: window.location.hostname,
            port: 8081,
            name: 'json-config-test',
            doNotLoadAllObjects: true,
            onProgress: (progress: number): void => {
                this.setState({ connected: progress !== PROGRESS.CONNECTING });
            },
            onReady: (): void => {
                this.setState({ loaded: true });
            },
            onError: (err: string): void => {
                console.error(err);
            },
        });
    }

    renderJsonConfig(): React.JSX.Element {
        return (
            <JsonConfigComponent
                // Without this, `ConfigPanel` sizes its panel with `calc(100vh - 259px)`, which is calibrated for the
                // admin chrome and leaves a large gap below this app's 48px toolbar. `withoutSaveButtons` switches it
                // to `calc(100% - 88px)`, i.e. relative to the container below.
                withoutSaveButtons
                socket={this.socket}
                theme={this.state.theme}
                themeName={this.state.themeName}
                themeType={this.state.themeName === 'dark' || this.state.themeName === 'blue' ? 'dark' : 'light'}
                adapterName={ADAPTER_NAME}
                instance={INSTANCE}
                isFloatComma={this.state.language !== 'en'}
                dateFormat="DD.MM.YYYY"
                imagePrefix={`${window.location.protocol}//${window.location.hostname}:8081`}
                expertMode={this.state.expertMode}
                schema={demoSchema as unknown as ConfigItemTabs}
                data={this.state.data}
                updateData={this.state.updateData}
                onError={(error: boolean): void => this.setState({ error })}
                onChange={(data: Record<string, any> | null, changed: boolean | undefined): void => {
                    if (data) {
                        window.localStorage.setItem('json-config-test-data', JSON.stringify(data));
                        this.setState({ data, changed: !!changed });
                    }
                }}
                onBackEndCommand={command => console.log(`Backend command: ${JSON.stringify(command)}`)}
            />
        );
    }

    // eslint-disable-next-line class-methods-use-this
    renderJson(json: unknown): React.JSX.Element {
        return (
            <pre
                style={{
                    margin: 0,
                    padding: 16,
                    height: '100%',
                    overflow: 'auto',
                    fontSize: 12,
                }}
            >
                {JSON.stringify(json, null, 2)}
            </pre>
        );
    }

    renderToolbar(): React.JSX.Element {
        // The controls must stay OUTSIDE of `Tabs`: `Tabs` clones every child and overwrites its `onChange` and
        // `value`, so a `Select` placed inside it would report to the tab handler instead of its own.
        return (
            <Box
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    backgroundColor: this.state.theme.palette.primary.main,
                    color: this.state.theme.palette.primary.contrastText,
                }}
            >
                <Tabs
                    value={this.state.tab}
                    onChange={(_e, tab: AppTab) => {
                        window.localStorage.setItem('json-config-test-tab', tab);
                        this.setState({ tab });
                    }}
                    textColor="inherit"
                    indicatorColor="secondary"
                >
                    <Tab
                        label="JSON Config"
                        value="config"
                    />
                    <Tab
                        label={`Data${this.state.changed ? ' *' : ''}`}
                        value="data"
                    />
                    <Tab
                        label="Schema"
                        value="schema"
                    />
                </Tabs>
                <Box style={{ flexGrow: 1 }} />
                {this.state.error ? (
                    <Box
                        style={{
                            marginRight: 16,
                            color: this.state.theme.palette.error.main,
                            fontWeight: 'bold',
                        }}
                    >
                        Validation error
                    </Box>
                ) : null}
                <Select
                    variant="standard"
                    value={this.state.language}
                    style={{ color: 'inherit' }}
                    onChange={e => {
                        const language = e.target.value;
                        window.localStorage.setItem('json-config-test-lang', language);
                        I18n.setLanguage(language);
                        this.setState({ language });
                    }}
                >
                    {LANGUAGES.map(lang => (
                        <MenuItem
                            key={lang}
                            value={lang}
                        >
                            {lang}
                        </MenuItem>
                    ))}
                </Select>
                <ToggleThemeMenu
                    style={{ color: 'inherit' }}
                    themeName={this.state.themeName}
                    toggleTheme={() => {
                        const themeName: ThemeName = this.state.themeName === 'dark' ? 'light' : 'dark';
                        window.localStorage.setItem('json-config-test-theme', themeName);
                        this.setState({ themeName, theme: Theme(themeName) });
                    }}
                    t={I18n.t}
                />
                <IconButton
                    onClick={() => {
                        window.localStorage.setItem('json-config-test-expert', String(!this.state.expertMode));
                        this.setState({ expertMode: !this.state.expertMode });
                    }}
                    style={{ color: this.state.expertMode ? 'orange' : 'inherit' }}
                    title={I18n.t('Expert Mode')}
                >
                    <IconExpert />
                </IconButton>
            </Box>
        );
    }

    render(): React.JSX.Element {
        return (
            <StyledEngineProvider injectFirst>
                <ThemeProvider theme={this.state.theme}>
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <Box
                            style={{
                                width: '100%',
                                height: '100vh',
                                display: 'flex',
                                flexDirection: 'column',
                                backgroundColor: this.state.theme.palette.background.default,
                                color: this.state.theme.palette.text.primary,
                            }}
                        >
                            {this.renderToolbar()}
                            {/* `minHeight: 0` lets this flex item shrink, so `height: 100%` inside resolves */}
                            <Box style={{ flexGrow: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
                                {this.state.loaded ? null : <Loader themeType={this.state.theme.palette.mode} />}
                                {this.state.loaded && this.state.tab === 'config' ? this.renderJsonConfig() : null}
                                {this.state.loaded && this.state.tab === 'data'
                                    ? this.renderJson(this.state.data)
                                    : null}
                                {this.state.loaded && this.state.tab === 'schema' ? this.renderJson(demoSchema) : null}
                            </Box>
                        </Box>
                    </LocalizationProvider>
                </ThemeProvider>
            </StyledEngineProvider>
        );
    }
}
