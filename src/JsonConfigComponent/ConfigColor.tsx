import React, { type JSX } from 'react';

import { ColorPicker } from '@iobroker/gui-components';

import type { ConfigItemColor } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';

interface ConfigColorProps extends ConfigGenericProps {
    schema: ConfigItemColor;
}

class ConfigColor extends ConfigGeneric<ConfigColorProps, ConfigGenericState> {
    renderItem(_error: unknown, disabled: boolean /* , defaultValue */): JSX.Element {
        const value = ConfigGeneric.getValue(this.props.data, this.props.attr);

        return (
            <ColorPicker
                id={`color_${this.props.attr || ''}_${this.props.index ?? ''}`}
                disabled={!!disabled}
                style={{ minWidth: 100, width: 'calc(100% - 8px)' }}
                label={this.getText(this.props.schema.label)}
                value={value || ''}
                // the previous picker always reported the color as #rrggbb
                format="hex"
                sx={
                    this.props.schema.noClearButton
                        ? {
                              // the color picker has no option to hide the clear button, so it is done via CSS
                              '& > .MuiIconButton-root': { display: 'none' },
                              '& > .MuiFormControl-root': { width: 'calc(100% - 56px)', mr: 1 },
                          }
                        : undefined
                }
                onChange={color => {
                    const mayBePromise = this.props.attr && this.onChange(this.props.attr, color);
                    if (mayBePromise instanceof Promise) {
                        void mayBePromise.catch(e => console.error(`Cannot set value: ${e}`));
                    }
                }}
            />
        );
    }
}

export default ConfigColor;
