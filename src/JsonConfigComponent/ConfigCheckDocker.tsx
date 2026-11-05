import React, { type JSX } from 'react';

import { FormControlLabel, Checkbox, FormHelperText, FormControl, FormLabel, CircularProgress } from '@mui/material';

import { I18n, IconResult } from '@iobroker/gui-components';

import type { ConfigItemCheckDocker } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';

interface ConfigCheckDockerState extends ConfigGenericState {
    version: string;
    errorDocker: string;
    /** Why Docker could not be checked. Then it is unknown and not missing, so the checkbox stays usable. */
    uncheckable: string;
    /** The host that was checked, if admin says it */
    host: string;
    requesting: boolean;
}

interface ConfigCheckDockerProps extends ConfigGenericProps {
    schema: ConfigItemCheckDocker;
}

// Send to an admin message to check if the docker available and if available, show checkbox, else show warning if specified in the schema
export default class ConfigCheckDocker extends ConfigGeneric<ConfigCheckDockerProps, ConfigCheckDockerState> {
    async componentDidMount(): Promise<void> {
        await super.componentDidMount();
        const id = await this.props.oContext.socket.getCurrentInstance();
        this.setState({ requesting: true }, async () => {
            // Docker is a property of the machine: admin has to check the host the instance runs on, which is
            // not necessarily its own one. An older admin ignores the message and checks its own host.
            const result: {
                version?: string;
                daemonRunning?: boolean;
                error?: string;
                host?: string;
            } = await this.props.oContext.socket.sendTo(id, 'checkDocker', {
                host: this.props.common?.host,
                instance: `${this.props.oContext.adapterName}.${this.props.oContext.instance}`,
            });
            this.setState({
                requesting: false,
                version: result?.version || '',
                host: result?.host || '',
                uncheckable: result?.error || '',
                errorDocker: result
                    ? !result.error && !result.daemonRunning
                        ? I18n.t('jc_Docker is not installed or not running')
                        : ''
                    : I18n.t('jc_No response from admin'),
            });
        });
    }

    /** Name the host, as it does not have to be the one of admin */
    private withHost(text: string): string {
        return this.state.host ? `${this.state.host}: ${text}` : text;
    }

    private renderHelpText(): JSX.Element | null {
        return this.props.schema.help || this.getValidatorErrorText() ? (
            <FormHelperText>
                {this.renderHelp(this.props.schema.help, this.props.schema.helpLink, this.props.schema.noTranslation)}
            </FormHelperText>
        ) : null;
    }

    /** Only the state of Docker, for adapters that let the user choose Docker with another control */
    private renderStatus(): JSX.Element {
        let text: string;
        let warning = true;
        if (this.state.uncheckable) {
            text = `${I18n.t('jc_Docker cannot be checked')}: ${this.state.uncheckable}`;
        } else if (this.state.errorDocker) {
            text = `${this.withHost(I18n.t('jc_Docker is not available'))}: ${this.state.errorDocker}`;
        } else {
            text = this.withHost(this.state.version);
            warning = false;
        }
        return (
            <FormControl
                style={{ width: '100%' }}
                variant="standard"
            >
                {this.props.schema.label ? <FormLabel>{this.getText(this.props.schema.label)}</FormLabel> : null}
                <FormHelperText
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        ...(warning ? { color: 'orange' } : undefined),
                    }}
                >
                    {/* draws itself when the answer arrives; a warning shakes once */}
                    <IconResult
                        type={warning ? 'warning' : 'success'}
                        fontSize={16}
                    />
                    {text}
                </FormHelperText>
                {this.renderHelpText()}
            </FormControl>
        );
    }

    renderItem(_error: unknown, disabled: boolean): JSX.Element {
        const value = ConfigGeneric.getValue(this.props.data, this.props.attr);

        if (this.state.requesting) {
            return <CircularProgress />;
        }
        if (this.props.schema.noCheckbox) {
            return this.renderStatus();
        }
        if (this.state.errorDocker && !value) {
            return (
                <FormHelperText style={{ color: 'orange' }}>
                    {this.withHost(I18n.t('jc_Docker is not available'))}:&nbsp;
                    {I18n.t(`jc_${this.state.errorDocker}`).replace(/^jc_/, '')}
                </FormHelperText>
            );
        }
        return (
            <FormControl
                style={{ width: '100%' }}
                variant="standard"
            >
                <FormControlLabel
                    onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();

                        if (!disabled && this.props.attr) {
                            const mayByPromise = this.onChange(this.props.attr, !value);
                            if (mayByPromise instanceof Promise) {
                                void mayByPromise.catch(e => console.error(`Cannot set value: ${e}`));
                            }
                        }
                    }}
                    control={
                        <Checkbox
                            checked={!!value}
                            onChange={e => {
                                if (this.props.attr) {
                                    void this.onChange(this.props.attr, e.target.checked);
                                }
                            }}
                            disabled={disabled || (!!this.state.errorDocker && !value)}
                        />
                    }
                    label={this.getText(this.props.schema.label)}
                />
                {!this.props.schema.hideVersion && this.state.uncheckable ? (
                    <FormHelperText style={{ color: 'orange' }}>
                        {I18n.t('jc_Docker cannot be checked')}:&nbsp;{this.state.uncheckable}
                    </FormHelperText>
                ) : null}
                {!this.props.schema.hideVersion && !this.state.uncheckable ? (
                    <FormHelperText>
                        {this.state.errorDocker ? this.state.errorDocker : this.withHost(this.state.version)}
                    </FormHelperText>
                ) : null}
                {this.renderHelpText()}
            </FormControl>
        );
    }
}
