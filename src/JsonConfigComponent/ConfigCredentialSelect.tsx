import React, { type JSX } from 'react';

import { InputLabel, MenuItem, FormControl, Select, FormHelperText } from '@mui/material';

import { I18n, Icon } from '@iobroker/adapter-react-v5';
import type { ConfigItemCredentialSelect } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';

/** Prefix of all credential object IDs. Synchronized with `@iobroker/adapter-core` (src/credentials.ts) */
const CREDENTIALS_PREFIX = 'system.credentials.';

interface ConfigCredentialSelectProps extends ConfigGenericProps {
    schema: ConfigItemCredentialSelect;
}

interface CredentialSelectOption {
    label: string;
    value: string;
    /** Icon of the credential (data URL from `common.icon`) */
    icon?: string;
}

interface ConfigCredentialSelectState extends ConfigGenericState {
    selectOptions?: CredentialSelectOption[];
}

function renderCredentialItem(
    option: CredentialSelectOption | undefined,
    label: string,
    anyIcon: boolean,
): JSX.Element {
    return (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {option?.icon ? (
                <Icon
                    src={option.icon}
                    style={{ width: 20, height: 20 }}
                />
            ) : anyIcon ? (
                // if at least one option has an icon, keep the labels aligned
                <span style={{ width: 20, height: 20, flexShrink: 0 }} />
            ) : null}
            {label}
        </span>
    );
}

export default class ConfigCredentialSelect extends ConfigGeneric<
    ConfigCredentialSelectProps,
    ConfigCredentialSelectState
> {
    async componentDidMount(): Promise<void> {
        await super.componentDidMount();
        const value = ConfigGeneric.getValue(this.props.data, this.props.attr);

        // Credentials are managed in admin: Settings -> Credentials.
        // They are stored as objects "system.credentials.<name>" with the category in native.type.
        let selectOptions: CredentialSelectOption[] = [];
        try {
            const objs = await this.props.oContext.socket.getObjectViewSystem(
                'config',
                CREDENTIALS_PREFIX,
                `${CREDENTIALS_PREFIX}香`,
            );
            selectOptions = Object.values(objs)
                .filter(
                    obj =>
                        !!obj &&
                        (!this.props.schema.credentialType ||
                            (obj.native as Record<string, any>)?.type === this.props.schema.credentialType),
                )
                .map(obj => ({
                    label: ConfigCredentialSelect.getCredentialName(obj as ioBroker.Object),
                    value: obj._id,
                    icon: typeof obj.common?.icon === 'string' ? obj.common.icon : undefined,
                }))
                .sort((a, b) => a.label.localeCompare(b.label));
        } catch (e) {
            console.error(`Cannot read credentials: ${e}`);
        }

        selectOptions.unshift({ label: I18n.t(ConfigGeneric.NONE_LABEL), value: ConfigGeneric.NONE_VALUE });

        this.setState({ value, selectOptions });
    }

    static getCredentialName(obj: ioBroker.Object): string {
        const name = obj.common?.name;
        let text: string;
        if (name && typeof name === 'object') {
            text = name[I18n.getLanguage()] || name.en || Object.values(name)[0] || '';
        } else {
            text = (name as string) || '';
        }
        return text || obj._id.substring(CREDENTIALS_PREFIX.length);
    }

    renderItem(error: unknown, disabled: boolean /* , defaultValue */): JSX.Element | null {
        if (!this.state.selectOptions) {
            return null;
        }

        const item = this.state.selectOptions?.find(_item => _item.value === this.state.value);
        // The stored value could point to a meanwhile deleted credential
        const unknownValue =
            this.state.value && this.state.value !== ConfigGeneric.NONE_VALUE && !item ? this.state.value : null;
        // if at least one option has an icon, options without icon get a placeholder for alignment
        const anyIcon = this.state.selectOptions.some(option => !!option.icon);

        return (
            <FormControl
                style={{ width: '100%' }}
                variant="standard"
            >
                {this.props.schema.label ? (
                    <InputLabel shrink>{this.getText(this.props.schema.label)}</InputLabel>
                ) : null}
                <Select
                    variant="standard"
                    error={!!error || !!unknownValue}
                    displayEmpty
                    disabled={!!disabled}
                    value={this.state.value || ConfigGeneric.NONE_VALUE}
                    renderValue={() =>
                        unknownValue
                            ? unknownValue
                            : renderCredentialItem(
                                  item,
                                  this.getText(item?.label, this.props.schema.noTranslation !== false),
                                  anyIcon,
                              )
                    }
                    onChange={e =>
                        this.setState(
                            { value: e.target.value === ConfigGeneric.NONE_VALUE ? '' : e.target.value },
                            () => this.onChange(this.props.attr, this.state.value),
                        )
                    }
                >
                    {this.state.selectOptions?.map(item_ => (
                        <MenuItem
                            key={item_.value}
                            value={item_.value}
                            style={item_.value === ConfigGeneric.NONE_VALUE ? { opacity: 0.5 } : {}}
                        >
                            {renderCredentialItem(
                                item_,
                                this.getText(item_.label, this.props.schema.noTranslation !== false),
                                anyIcon,
                            )}
                        </MenuItem>
                    ))}
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
