import React, { type JSX } from 'react';

import {
    InputLabel,
    FormHelperText,
    FormControl,
    FormLabel,
    Select,
    MenuItem,
    ListSubheader,
    Chip,
    ListItemText,
    Checkbox,
    RadioGroup,
    Radio,
    FormControlLabel,
    Typography,
} from '@mui/material';

import { I18n } from '@iobroker/adapter-react-v5';

import type { ConfigItemSelect, ConfigItemSelectOption } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';

const styles: Record<string, any> = {
    fullWidth: {
        width: '100%',
    },
    noMargin: {
        '&>div': {
            marginTop: 0,
        },
    },
};

interface ConfigInstanceSelectProps extends ConfigGenericProps {
    schema: ConfigItemSelect;
}

interface ConfigInstanceSelectState extends ConfigGenericState {
    selectOptions?: {
        label: string;
        value: number | string;
        group?: boolean;
        hidden?: string | boolean;
        color?: string;
        description?: string;
    }[];
}

export default class ConfigSelect extends ConfigGeneric<ConfigInstanceSelectProps, ConfigInstanceSelectState> {
    private initialValue: string | string[] = '';

    componentDidMount(): void {
        super.componentDidMount();
        let value: string | string[] = ConfigGeneric.getValue(this.props.data, this.props.attr);

        if (this.props.schema.multiple) {
            if (typeof value === 'string') {
                value = [value];
            } else if (value === null || value === undefined) {
                value = [];
            }
        }

        const selectOptions: {
            label: string;
            value: number | string;
            group?: boolean;
            hidden?: string | boolean;
            color?: string;
            description?: string;
        }[] = [];

        (this.props.schema.options || []).forEach(item => {
            // if optgroup
            const groupItem: {
                items: ConfigItemSelectOption[];
                label: ioBroker.StringOrTranslated;
                value?: number | string;
                hidden?: string | boolean;
                description?: string;
            } = item as {
                items: ConfigItemSelectOption[];
                label: ioBroker.StringOrTranslated;
                value?: number | string;
                hidden?: string | boolean;
                description?: string;
            };
            if (Array.isArray(groupItem.items)) {
                selectOptions.push({
                    label: this.getText(item.label, this.props.schema.noTranslation),
                    value: item.value,
                    group: true,
                    color: item.color,
                    description: this.getText(item.description),
                });
                groupItem.items.forEach(it =>
                    selectOptions.push({
                        label: this.getText(it.label, this.props.schema.noTranslation),
                        value: it.value,
                        hidden: it.hidden,
                        color: item.color,
                        description: this.getText(item.description),
                    }),
                );
            } else {
                selectOptions.push({
                    label: this.getText(item.label, this.props.schema.noTranslation),
                    value: item.value,
                    hidden: item.hidden,
                    color: item.color,
                    description: this.getText(item.description),
                });
            }
        });

        // Report value-to-label mapping to parent table for filtering
        if (this.props.onFilterLabelUpdate && this.props.table) {
            const valueToLabel: Record<string, string> = {};
            for (const opt of selectOptions) {
                if (!opt.group && opt.value !== ConfigGeneric.DIFFERENT_VALUE) {
                    valueToLabel[opt.value.toString()] = opt.label;
                }
            }
            this.props.onFilterLabelUpdate(this.props.attr, valueToLabel);
        }

        // if __different
        if (Array.isArray(value) && !this.props.schema.multiple) {
            this.initialValue = [...value];
            selectOptions.unshift({
                label: I18n.t(ConfigGeneric.DIFFERENT_LABEL),
                value: ConfigGeneric.DIFFERENT_VALUE,
            });
            this.setState({ value: ConfigGeneric.DIFFERENT_VALUE, selectOptions });
        } else {
            this.setState({ value, selectOptions });
        }
    }

    _getValue(): string | string[] {
        let value =
            this.state.value === null || this.state.value === undefined
                ? ConfigGeneric.getValue(this.props.data, this.props.attr)
                : this.state.value;

        if (this.props.schema.multiple) {
            if (typeof value === 'string') {
                value = [value];
            } else if (value === null || value === undefined) {
                value = [];
            }
        }

        return value;
    }

    _filterOptions(
        selectOptions: ConfigInstanceSelectState['selectOptions'],
    ): ConfigInstanceSelectState['selectOptions'] {
        return (selectOptions || []).filter(item => {
            // if optgroup or no hidden function
            if (!item.hidden) {
                return true;
            }

            if (this.props.custom) {
                return !this.executeCustom(
                    item.hidden,
                    this.props.data,
                    this.props.customObj,
                    this.props.oContext.instanceObj,
                    this.props.arrayIndex,
                    this.props.globalData,
                );
            }
            return !this.execute(
                item.hidden,
                this.props.schema.default,
                this.props.data,
                this.props.arrayIndex,
                this.props.globalData,
            );
        });
    }

    renderRadio(error: string, disabled: boolean): JSX.Element {
        const selectOptions = this._filterOptions(this.state.selectOptions).filter(it => !it.group);
        const value = this._getValue();

        return (
            <FormControl
                fullWidth
                error={!!error}
                disabled={!!disabled}
                id={`jsonSelect_${this.props.attr}_${this.props.index || this.props.index === 0 ? this.props.index : ''}`}
            >
                {this.props.schema.label ? <FormLabel>{this.getText(this.props.schema.label)}</FormLabel> : null}
                <RadioGroup
                    value={value === undefined || value === null ? '' : value.toString()}
                    onChange={e => {
                        // find the original option value to preserve its type (number vs string)
                        const opt = selectOptions.find(it => it.value.toString() === e.target.value);
                        const newValue = opt ? opt.value : e.target.value;
                        this.setState({ value: newValue }, () => {
                            const mayBePromise = this.onChange(this.props.attr, newValue);
                            if (mayBePromise instanceof Promise) {
                                mayBePromise.catch(e => console.error(e));
                            }
                        });
                    }}
                >
                    {selectOptions.map((it, i) => (
                        <FormControlLabel
                            key={i}
                            value={it.value.toString()}
                            control={<Radio />}
                            title={it.description || ''}
                            label={
                                <Typography
                                    component="span"
                                    style={{ color: it.color }}
                                >
                                    {it.label}
                                </Typography>
                            }
                            style={it.value === ConfigGeneric.DIFFERENT_VALUE ? { opacity: 0.5 } : {}}
                        />
                    ))}
                </RadioGroup>
                {this.props.schema.help ? (
                    <FormHelperText>
                        {this.renderHelp(
                            this.props.schema.help,
                            this.props.schema.helpLink,
                            this.props.schema.noTranslation,
                        )}
                    </FormHelperText>
                ) : null}
            </FormControl>
        );
    }

    renderItem(error: string, disabled: boolean /* , defaultValue */): JSX.Element {
        if (!this.state.selectOptions) {
            return null;
        }

        if (this.props.schema.format === 'radio') {
            return this.renderRadio(error, disabled);
        }

        const selectOptions = this._filterOptions(this.state.selectOptions);

        const value = this._getValue();

        const item = this.props.schema.multiple ? null : selectOptions.find(it => it.value == value); // let "==" be and not ===

        return (
            <FormControl
                variant="standard"
                fullWidth
                sx={this.props.table !== undefined && styles.noMargin}
                id={`jsonSelect_${this.props.attr}_${this.props.index || this.props.index === 0 ? this.props.index : ''}`}
            >
                {this.props.schema.label ? <InputLabel>{this.getText(this.props.schema.label)}</InputLabel> : null}
                <Select
                    variant="standard"
                    error={!!error}
                    multiple={this.props.schema.multiple}
                    disabled={!!disabled}
                    value={value || '_'}
                    renderValue={(val: string | string[]) =>
                        this.props.schema.multiple ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {(val as string[]).map((v: string) => {
                                    const it = selectOptions.find(_item => _item.value === v);
                                    if (it || this.props.schema.showAllValues !== false) {
                                        const label = it?.label || v;
                                        return (
                                            <Chip
                                                key={v}
                                                label={label}
                                            />
                                        );
                                    }
                                    return null;
                                })}
                            </div>
                        ) : item?.color ? (
                            <>
                                <div style={{ color: item.color }}>{item.label === undefined ? val : item.label}</div>
                                {item.description ? (
                                    <div style={{ opacity: 0.7, fontStyle: 'italic', fontSize: 'smaller' }}>
                                        {item.description}
                                    </div>
                                ) : null}
                            </>
                        ) : item?.label === undefined ? (
                            val
                        ) : (
                            <>
                                <div>{item.label}</div>
                                {item.description ? (
                                    <div style={{ opacity: 0.7, fontStyle: 'italic', fontSize: 'smaller' }}>
                                        {item.description}
                                    </div>
                                ) : null}
                            </>
                        )
                    }
                    onChange={e => {
                        this.setState({ value: e.target.value === '_' ? '' : e.target.value }, () => {
                            let mayBePromise: void | Promise<void>;
                            if (this.state.value === ConfigGeneric.DIFFERENT_VALUE) {
                                mayBePromise = this.onChange(this.props.attr, this.initialValue);
                            } else {
                                mayBePromise = this.onChange(this.props.attr, this.state.value);
                            }
                            if (mayBePromise instanceof Promise) {
                                mayBePromise.catch(e => console.error(e));
                            }
                        });
                    }}
                >
                    {selectOptions.map((it, i) => {
                        if (it.group) {
                            return (
                                <ListSubheader
                                    key={i}
                                    style={{ color: it.color }}
                                >
                                    <div>{it.label}</div>
                                    {item.description ? (
                                        <div style={{ opacity: 0.7, fontStyle: 'italic', fontSize: 'smaller' }}>
                                            {item.description}
                                        </div>
                                    ) : null}
                                </ListSubheader>
                            );
                        }
                        return (
                            <MenuItem
                                key={i}
                                value={it.value}
                                style={it.value === ConfigGeneric.DIFFERENT_VALUE ? { opacity: 0.5 } : {}}
                            >
                                {this.props.schema.multiple ? (
                                    <Checkbox
                                        checked={value.includes(it.value as string)}
                                        onClick={() => {
                                            const _value = JSON.parse(JSON.stringify(this._getValue()));
                                            const pos = value.indexOf(it.value as string);
                                            if (pos !== -1) {
                                                _value.splice(pos, 1);
                                            } else {
                                                _value.push(it.value);
                                                _value.sort();
                                            }
                                            this.setState({ value: _value }, () =>
                                                this.onChange(this.props.attr, _value),
                                            );
                                        }}
                                    />
                                ) : null}
                                <ListItemText
                                    primary={it.label}
                                    secondary={it.description}
                                    slotProps={{
                                        secondary: {
                                            style: { fontSize: 'smaller', fontStyle: 'italic', opacity: 0.7 },
                                        },
                                    }}
                                    style={{ color: it.color }}
                                />
                            </MenuItem>
                        );
                    })}
                </Select>
                {this.props.schema.help ? (
                    <FormHelperText>
                        {this.renderHelp(
                            this.props.schema.help,
                            this.props.schema.helpLink,
                            this.props.schema.noTranslation,
                        )}
                    </FormHelperText>
                ) : null}
            </FormControl>
        );
    }
}
