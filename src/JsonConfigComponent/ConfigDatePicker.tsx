import React, { type JSX } from 'react';

import { DatePicker } from '@mui/x-date-pickers';

import type { ConfigItemDatePicker } from '../types';
import ConfigGeneric, { type ConfigGenericProps } from './ConfigGeneric';

interface ConfigDatePickerProps extends ConfigGenericProps {
    schema: ConfigItemDatePicker;
}

export default class ConfigDatePicker extends ConfigGeneric<ConfigDatePickerProps> {
    componentDidMount(): void {
        super.componentDidMount();
        const str = ConfigGeneric.getValue(this.props.data, this.props.attr);
        // Date picker expects a Date object
        if (str) {
            try {
                const date = new Date(str);
                this.setState({ value: date });
            } catch {
                // ignore
            }
        }
    }

    renderItem(_error: unknown, disabled: boolean /* , defaultValue */): JSX.Element {
        return (
            <DatePicker
                sx={theme => ({
                    width: '100%',
                    borderBottom: `1px solid ${theme.palette.text.primary}`,
                    '& fieldset': {
                        display: 'none',
                    },
                    '& input': {
                        padding: `${theme.spacing(1.5)} 0 4px 0`,
                    },
                    '& .MuiInputAdornment-root': {
                        marginLeft: 0,
                        marginTop: 1, // it is already in spaces
                    },
                    '& label': {
                        transform: 'translate(0px, -9px) scale(0.75)',
                    },
                })}
                format={this.props.oContext.systemConfig.dateFormat.toLowerCase().replace('mm', 'MM')}
                disabled={!!disabled}
                value={(this.state.value as never) || null}
                onChange={(value: Date): void =>
                    this.setState({ value }, () => {
                        try {
                            const dateStr = this.state.value.toISOString();
                            this.onChange(this.props.attr, dateStr).catch(e =>
                                console.warn(`Error saving value for ${this.props.attr}:`, e),
                            );
                        } catch {
                            // ignore
                        }
                    })
                }
                label={this.getText(this.props.schema.label)}
            />
        );
    }
}
