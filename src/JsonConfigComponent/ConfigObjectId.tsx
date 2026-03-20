import React, { type JSX } from 'react';

import { InputLabel, FormControl, Button, TextField } from '@mui/material';

import { DialogSelectID } from '@iobroker/adapter-react-v5';

import type { ConfigItemObjectId } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';

const styles: Record<string, React.CSSProperties> = {
    flex: {
        display: 'flex',
    },
    button: {
        maxHeight: 48,
        marginLeft: 4,
        minWidth: 48,
    },
};

interface ConfigObjectIdProps extends ConfigGenericProps {
    schema: ConfigItemObjectId;
}

interface ConfigObjectIdState extends ConfigGenericState {
    showSelectId?: boolean;
    initialized?: boolean;
}

class ConfigObjectId extends ConfigGeneric<ConfigObjectIdProps, ConfigObjectIdState> {
    private fillOnSelect: { attr: string; pathInObject: string; overwrite?: boolean }[] = [];

    componentDidMount(): void {
        super.componentDidMount();
        const { data, attr } = this.props;
        const value = ConfigGeneric.getValue(data, attr) || '';
        if (this.props.schema.fillOnSelect) {
            // parse common.name=>name,common.color=>color(X)
            const items = this.props.schema.fillOnSelect.split(',').map(it => it.trim());
            for (const item of items) {
                const parts = item.split('=>');
                if (parts.length === 2) {
                    const fillItem: { attr: string; pathInObject: string; overwrite?: boolean } = {
                        pathInObject: parts[0],
                        attr: parts[1],
                    };
                    if (fillItem.attr.includes('(X)') || fillItem.attr.includes('(x)')) {
                        fillItem.overwrite = true;
                        fillItem.attr = fillItem.attr.replace(/\(X\)|\(x\)/g, '');
                    }
                    this.fillOnSelect.push(fillItem);
                } else {
                    console.error(`Invalid format for fillOnSelect: ${this.props.schema.fillOnSelect}`);
                }
            }
        }

        this.setState({ value, initialized: true });
    }

    onObjectChanged = (attr: string, value: string): void => {
        void this.onChange(attr, value, async (): Promise<void> => {
            if (this.fillOnSelect.length) {
                try {
                    const obj = await this.props.oContext.socket.getObject(value);
                    for (const item of this.fillOnSelect) {
                        if (item.overwrite || !ConfigGeneric.getValue(this.props.data, item.attr)) {
                            let objVal = ConfigGeneric.getValue(obj, item.pathInObject);
                            // Special case for translated name
                            if (typeof objVal === 'object') {
                                objVal = this.getText(objVal, true);
                            }
                            await this.onChange(item.attr, objVal);
                        }
                    }
                } catch (e) {
                    console.error(e.toString());
                }
            }
        });
    };

    renderItem(error: string, disabled: boolean /* , defaultValue */): JSX.Element {
        if (!this.state.initialized) {
            return null;
        }
        const socket = this.props.oContext.socket;
        const { schema, attr } = this.props;
        const { value, showSelectId } = this.state;

        return (
            <FormControl
                fullWidth
                variant="standard"
            >
                {schema.label ? <InputLabel shrink>{this.getText(schema.label)}</InputLabel> : null}
                <div style={styles.flex}>
                    <TextField
                        variant="standard"
                        fullWidth
                        value={value}
                        error={!!error}
                        disabled={disabled}
                        placeholder={this.getText(schema.placeholder)}
                        label={this.getText(schema.label)}
                        helperText={this.renderHelp(schema.help, schema.helpLink, schema.noTranslation)}
                        onChange={e => {
                            // Store it to have the possibility to access it in onObjectChanged
                            const value = Array.isArray(e.target.value) ? e.target.value[0] : e.target.value;
                            this.setState({ value }, () => this.onObjectChanged(attr, value));
                        }}
                    />
                    <Button
                        color="grey"
                        disabled={disabled}
                        style={styles.button}
                        size="small"
                        variant="outlined"
                        onClick={() => this.setState({ showSelectId: true })}
                    >
                        ...
                    </Button>
                </div>
                {showSelectId ? (
                    <DialogSelectID
                        imagePrefix={
                            this.props.oContext.imagePrefix === undefined ? '../..' : this.props.oContext.imagePrefix
                        }
                        dialogName={`admin.${this.props.oContext.adapterName}`}
                        filterFunc={schema.filterFunc}
                        themeType={this.props.oContext.themeType}
                        theme={this.props.oContext.theme}
                        types={schema.types ? (Array.isArray(schema.types) ? schema.types : [schema.types]) : undefined}
                        customFilter={schema.customFilter}
                        filters={schema.filters}
                        socket={socket}
                        selected={value}
                        root={schema.root}
                        onClose={() => this.setState({ showSelectId: false })}
                        onOk={value_ => {
                            const val = Array.isArray(value_) ? value_[0] : value_;
                            this.setState({ showSelectId: false, value: val }, () => this.onObjectChanged(attr, val));
                        }}
                    />
                ) : null}
            </FormControl>
        );
    }
}

export default ConfigObjectId;
