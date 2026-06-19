import React, { type JSX } from 'react';

import { IconButton, TextField } from '@mui/material';

import { I18n, IconCopy, Utils } from '@iobroker/adapter-react-v5';
import type { ConfigItemPattern } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';

interface ConfigPatternProps extends ConfigGenericProps {
    schema: ConfigItemPattern;
}

interface ConfigPatternState extends ConfigGenericState {
    pattern?: string;
}

class ConfigPattern extends ConfigGeneric<ConfigPatternProps, ConfigPatternState> {
    private checkTimeout: ReturnType<typeof setTimeout> | null = null;

    async componentDidMount(): Promise<void> {
        await super.componentDidMount();
        const pattern = (await this.getPatternAsync(this.props.schema.pattern, null, true)) ?? '';
        this.setState({ pattern });
    }

    componentWillUnmount(): void {
        if (this.checkTimeout) {
            clearTimeout(this.checkTimeout);
            this.checkTimeout = null;
        }
        super.componentWillUnmount();
    }

    checkIfInstanceChanged(): void {
        if (this.checkTimeout) {
            clearTimeout(this.checkTimeout);
        }
        this.checkTimeout = setTimeout(async () => {
            this.checkTimeout = null;
            const pattern = (await this.getPatternAsync(this.props.schema.pattern, null, true)) ?? '';
            if (pattern !== this.state.pattern) {
                this.setState({ pattern });
            }
        }, 200);
    }

    renderItem(_error: unknown, disabled: boolean): JSX.Element | null {
        this.checkIfInstanceChanged();
        return (
            <TextField
                variant="standard"
                fullWidth
                disabled={!!disabled}
                slotProps={{
                    input: {
                        endAdornment: this.props.schema.copyToClipboard ? (
                            <IconButton
                                tabIndex={-1}
                                size="small"
                                onClick={async () => {
                                    Utils.copyToClipboard(
                                        await this.getPatternAsync(
                                            this.props.schema.pattern,
                                            null,
                                            this.props.schema.noTranslation,
                                        ),
                                    );
                                    window.alert(I18n.t('jc_Copied'));
                                }}
                            >
                                <IconCopy />
                            </IconButton>
                        ) : undefined,
                    },
                }}
                value={this.state.pattern || ''}
                label={this.getText(this.props.schema.label)}
                helperText={this.renderHelp(
                    this.props.schema.help,
                    this.props.schema.helpLink,
                    this.props.schema.noTranslation,
                )}
            />
        );
    }
}

export default ConfigPattern;
