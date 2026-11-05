import React, { type JSX } from 'react';

import { TextField, Fab, FormControlLabel, Checkbox } from '@mui/material';

import { GpsFixed as IconGpsFixed, LocationOn as IconLocationOn } from '@mui/icons-material';

import { I18n } from '@iobroker/gui-components';

import type { ConfigItemCoordinates } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
import OsmMap, { type OsmMapPosition, type OsmMapStyle } from './wrapper/Components/OsmMap';

const styles: Record<string, React.CSSProperties> = {
    width: {
        width: 'calc(100% - 85px)',
    },
    width50: {
        width: 120,
        marginRight: 5,
    },
};

/** Decimal places of a position set on the map: 6 places are about 10 cm, more is only noise of the mouse */
const MAP_PRECISION = 1_000_000;

interface ConfigCoordinatesProps extends ConfigGenericProps {
    schema: ConfigItemCoordinates;
}

interface ConfigCoordinatesState extends ConfigGenericState {
    useSystem?: boolean;
    longitude?: string | number;
    latitude?: string | number;
}

/** What the item shows */
interface ShownValues {
    useSystem: boolean;
    longitude?: string | number;
    latitude?: string | number;
    /** `latitude,longitude` if the position is stored in one attribute */
    value?: string | number;
}

/** Reads one coordinate, written with a point or a comma */
function parseCoordinate(value: string | number | null | undefined, limit: number): number | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const num = typeof value === 'number' ? value : parseFloat(String(value).trim().replace(',', '.'));
    return Number.isFinite(num) && Math.abs(num) <= limit ? num : null;
}

function toPosition(
    latitude: string | number | null | undefined,
    longitude: string | number | null | undefined,
): OsmMapPosition | null {
    const lat = parseCoordinate(latitude, 90);
    const lng = parseCoordinate(longitude, 180);
    return lat === null || lng === null ? null : { latitude: lat, longitude: lng };
}

export default class ConfigCoordinates extends ConfigGeneric<ConfigCoordinatesProps, ConfigCoordinatesState> {
    async componentDidMount(): Promise<void> {
        await super.componentDidMount();

        const value = ConfigGeneric.getValue(this.props.data, this.props.attr);
        this.setState({ value });

        // a read-only item only shows the position, it does not determine one
        const autoInit = this.props.schema.autoInit && !this.props.schema.readOnly;

        const newState: Partial<ConfigCoordinatesState> = {};
        if (this.props.schema.useSystemName) {
            newState.useSystem = !!ConfigGeneric.getValue(this.props.data, this.props.schema.useSystemName);
        }
        if (this.isSeparated()) {
            newState.longitude = ConfigGeneric.getValue(this.props.data, this.props.schema.longitudeName);
            newState.latitude = ConfigGeneric.getValue(this.props.data, this.props.schema.latitudeName);
            if (!newState.longitude && !newState.latitude && autoInit) {
                setTimeout(() => this.getCoordinates(), 300);
            }
        } else if (!value && autoInit) {
            setTimeout(() => this.getCoordinates(), 300);
        }
        if (Object.keys(newState).length) {
            setTimeout(() => this.setState(newState as ConfigCoordinatesState), 50);
        }
    }

    /** If latitude and longitude are stored in two attributes, else in one as `latitude,longitude` */
    isSeparated(): boolean {
        return !!(this.props.schema.longitudeName && this.props.schema.latitudeName);
    }

    /**
     * An editable item shows what the user typed. A read-only one shows the data as they are now:
     * nothing is typed there, and the position may be set meanwhile by another item or the backend.
     */
    getShownValues(): ShownValues {
        if (!this.props.schema.readOnly) {
            return {
                useSystem: !!this.state.useSystem,
                longitude: this.state.longitude,
                latitude: this.state.latitude,
                value: this.state.value,
            };
        }
        const data = this.props.data;
        const schema = this.props.schema;
        return {
            useSystem: !!(schema.useSystemName && ConfigGeneric.getValue(data, schema.useSystemName)),
            longitude: this.isSeparated() ? ConfigGeneric.getValue(data, schema.longitudeName) : undefined,
            latitude: this.isSeparated() ? ConfigGeneric.getValue(data, schema.latitudeName) : undefined,
            value: this.isSeparated() ? undefined : ConfigGeneric.getValue(data, this.props.attr),
        };
    }

    /** The position of the shown values, `null` if it is not set or not valid */
    getPosition(shown: ShownValues): OsmMapPosition | null {
        if (this.isSeparated()) {
            return toPosition(shown.latitude, shown.longitude);
        }
        if (shown.value === null || shown.value === undefined) {
            return null;
        }
        const [latitude, longitude] = String(shown.value).split(this.props.schema.divider || ',');
        return toPosition(latitude, longitude);
    }

    /** Stores a position, wherever it comes from: browser, system settings or map */
    setPosition(latitude: number, longitude: number): void {
        if (this.isSeparated()) {
            this.setState({ longitude, latitude }, async () => {
                await this.onChange(this.props.schema.longitudeName, longitude);
                await this.onChange(this.props.schema.latitudeName, latitude);
            });
        } else {
            const value = `${latitude}${this.props.schema.divider || ','}${longitude}`;
            this.setState({ value }, () => {
                const mayByPromise = this.onChange(this.props.attr, value);
                if (mayByPromise instanceof Promise) {
                    mayByPromise.catch(e => console.error(`Cannot set value: ${e}`));
                }
            });
        }
    }

    async getSystemCoordinates(): Promise<void> {
        let systemConfig: ioBroker.SystemConfigObject | undefined;
        try {
            if (this.props.oContext.socket.getCompactSystemConfig) {
                systemConfig = await this.props.oContext.socket.getCompactSystemConfig();
            } else {
                systemConfig = (await this.getCachedObject('system.config')) as ioBroker.SystemConfigObject | undefined;
            }
        } catch (e) {
            console.error(`Cannot get system configuration: ${e}`);
        }
        const position = systemConfig?.common
            ? toPosition(systemConfig.common.latitude, systemConfig.common.longitude)
            : null;
        if (position) {
            window.alert(I18n.t('jc_Used system settings'));
            this.setPosition(position.latitude, position.longitude);
        } else {
            window.alert(
                I18n.t(
                    'jc_Cannot determine position: System settings are empty and GPS detection is disabled in browser',
                ),
            );
        }
    }

    getCoordinates(): void {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position: GeolocationPosition): Promise<void> => {
                    if (position?.coords) {
                        this.setPosition(position.coords.latitude, position.coords.longitude);
                    } else {
                        await this.getSystemCoordinates();
                    }
                },
                async (error: GeolocationPositionError): Promise<void> => {
                    console.error(`Cannot determine coordinates from browser: ${error.message}`);
                    await this.getSystemCoordinates();
                },
            );
        } else {
            void this.getSystemCoordinates().catch(e => {
                console.error(`Cannot determine coordinates: ${e}`);
            });
        }
    }

    renderMap(position: OsmMapPosition | null, readOnly: boolean): JSX.Element | null {
        if (!this.props.schema.map) {
            return null;
        }
        const systemConfig = this.props.oContext.systemConfig;
        const themeType = this.props.oContext.themeType;
        // `auto` darkens the map only in a dark theme
        const mapStyle: OsmMapStyle =
            this.props.schema.mapStyle === 'auto'
                ? themeType === 'dark'
                    ? 'dark'
                    : 'standard'
                : this.props.schema.mapStyle || 'standard';
        return (
            <OsmMap
                OsmMap={this.props.oContext.OsmMap}
                position={position}
                center={systemConfig ? toPosition(systemConfig.latitude, systemConfig.longitude) : null}
                zoom={this.props.schema.mapZoom || 13}
                height={this.props.schema.mapHeight || 300}
                mapStyle={mapStyle}
                themeType={themeType}
                onChange={
                    readOnly
                        ? undefined
                        : position =>
                              this.setPosition(
                                  Math.round(position.latitude * MAP_PRECISION) / MAP_PRECISION,
                                  Math.round(position.longitude * MAP_PRECISION) / MAP_PRECISION,
                              )
                }
            />
        );
    }

    renderItem(error: string, disabled: boolean /* , defaultValue */): JSX.Element {
        const readOnly = !!this.props.schema.readOnly;
        const shown = this.getShownValues();
        // the position cannot be changed by the user: the fields show it, but nothing sets it
        const locked = readOnly || !!disabled || shown.useSystem;

        return (
            <>
                {this.props.schema.useSystemName ? (
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={shown.useSystem}
                                disabled={readOnly || !!disabled}
                                onChange={e => {
                                    const useSystem = e.target.checked;
                                    if (useSystem) {
                                        void this.getSystemCoordinates().catch(e =>
                                            console.error(`Cannot determine coordinates: ${e}`),
                                        );
                                    }
                                    this.setState({ useSystem }, () =>
                                        this.onChange(this.props.schema.useSystemName, useSystem),
                                    );
                                }}
                            />
                        }
                        label={I18n.t('jc_Use system settings for position')}
                    />
                ) : null}
                {this.isSeparated() ? (
                    <TextField
                        variant="standard"
                        style={styles.width50}
                        value={shown.longitude ?? ''}
                        error={!!error}
                        disabled={shown.useSystem || !!disabled}
                        slotProps={{ htmlInput: { readOnly } }}
                        onChange={e => {
                            const longitude = e.target.value;
                            this.setState({ longitude }, () => {
                                const mayBePromise = this.onChange(
                                    this.props.schema.longitudeName,
                                    (longitude || '').trim(),
                                );
                                if (mayBePromise instanceof Promise) {
                                    mayBePromise.catch(e => console.error(`Cannot set value: ${e}`));
                                }
                            });
                        }}
                        label={I18n.t('jc_Longitude')}
                    />
                ) : null}
                {this.isSeparated() ? (
                    <TextField
                        variant="standard"
                        style={styles.width50}
                        value={shown.latitude ?? ''}
                        error={!!error}
                        disabled={shown.useSystem || !!disabled}
                        slotProps={{ htmlInput: { readOnly } }}
                        onChange={e => {
                            const latitude = e.target.value;
                            this.setState({ latitude }, () =>
                                this.onChange(this.props.schema.latitudeName, (latitude || '').trim()),
                            );
                        }}
                        label={I18n.t('jc_Latitude')}
                    />
                ) : null}
                {!this.isSeparated() ? (
                    <TextField
                        variant="standard"
                        style={readOnly ? { width: '100%' } : styles.width}
                        value={shown.value ?? ''}
                        error={!!error}
                        disabled={!!disabled}
                        slotProps={{
                            htmlInput: {
                                maxLength: this.props.schema.maxLength || this.props.schema.max || undefined,
                                readOnly: readOnly || shown.useSystem,
                            },
                        }}
                        onChange={e => {
                            const value = e.target.value;
                            this.setState({ value }, () => this.onChange(this.props.attr, (value || '').trim()));
                        }}
                        placeholder={this.getText(this.props.schema.placeholder)}
                        label={this.getText(this.props.schema.label)}
                        helperText={this.renderHelp(
                            this.props.schema.help,
                            this.props.schema.helpLink,
                            this.props.schema.noTranslation,
                        )}
                    />
                ) : null}
                {!readOnly && !shown.useSystem ? (
                    <Fab
                        size="small"
                        disabled={!!disabled}
                        onClick={() => this.getCoordinates()}
                        title={I18n.t('jc_Take browser position')}
                        style={{ marginRight: 4 }}
                    >
                        <IconLocationOn />
                    </Fab>
                ) : null}
                {!readOnly && !shown.useSystem ? (
                    <Fab
                        size="small"
                        disabled={!!disabled}
                        onClick={() => this.getSystemCoordinates()}
                        title={I18n.t('jc_Take position from system settings')}
                    >
                        <IconGpsFixed />
                    </Fab>
                ) : null}
                {this.renderMap(this.getPosition(shown), locked)}
            </>
        );
    }
}
