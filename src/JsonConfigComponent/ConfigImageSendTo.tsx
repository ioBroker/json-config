import React, { type JSX } from 'react';

import { CircularProgress } from '@mui/material';
import { I18n, Icon } from '@iobroker/adapter-react-v5';

import type { ConfigItemImageSendTo } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';

interface ConfigImageSendToProps extends ConfigGenericProps {
    schema: ConfigItemImageSendTo;
}

interface ConfigImageSendToState extends ConfigGenericState {
    image?: string;
    loading?: boolean;
}

export default class ConfigImageSendTo extends ConfigGeneric<ConfigImageSendToProps, ConfigImageSendToState> {
    private initialized = false;

    private localContext: string | undefined;

    async componentDidMount(): Promise<void> {
        await super.componentDidMount();

        if (!this.props.schema.sendFirstByClick) {
            this.askInstance().catch((err: Error) => console.error(err));
        }
    }

    async askInstance(): Promise<void> {
        if (this.props.alive) {
            let data = this.props.schema.data;
            if (data === undefined && this.props.schema.jsonData) {
                const dataStr: string = await this.getPatternAsync(this.props.schema.jsonData, null, true);
                if (dataStr) {
                    try {
                        data = JSON.parse(dataStr);
                    } catch {
                        console.error(`Cannot parse json data: ${JSON.stringify(data)}`);
                    }
                }
            }

            if (data === undefined) {
                data = null;
            }
            const instance = await this.getPatternAsync(
                this.props.schema.instance || `${this.props.oContext.adapterName}.${this.props.oContext.instance}`,
            );
            // Check that instance is alive
            if (instance !== `${this.props.oContext.adapterName}.${this.props.oContext.instance}`) {
                const alive = await this.props.oContext.socket.getState(`system.adapter.${instance}.alive`);
                if (!alive?.val) {
                    window.alert(I18n.t('jc_Instance %s is not alive', instance));
                    return;
                }
            }
            this.setState({ loading: true }, () =>
                this.props.oContext.socket
                    .sendTo(instance, this.props.schema.command || 'send', data)
                    .then(image => this.setState({ image: image || '' })),
            );
        }
    }

    getContext(): string {
        const localContext: Record<string, any> = {};

        if (Array.isArray(this.props.schema.alsoDependsOn)) {
            this.props.schema.alsoDependsOn.forEach(
                attr => (localContext[attr] = ConfigGeneric.getValue(this.props.data, attr)),
            );
        }

        return JSON.stringify(localContext);
    }

    renderItem(/* error, disabled, defaultValue */): JSX.Element {
        if (this.props.alive) {
            const localContext = this.getContext();
            if (localContext !== this.localContext || !this.initialized) {
                this.localContext = localContext;
                if (!this.props.schema.sendFirstByClick || this.state.image !== undefined) {
                    setTimeout(() => this.askInstance(), this.initialized ? 300 : 50);
                }
                this.initialized = true;
            }
        }

        if (!this.state.image && this.props.schema.sendFirstByClick) {
            return (
                <div
                    style={{
                        width: this.props.schema.width || '100%',
                        height: this.props.schema.height,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: this.state.loading ? 'default' : 'pointer',
                    }}
                    onClick={() => !this.state.loading && this.askInstance()}
                >
                    {this.state.loading ? (
                        <CircularProgress />
                    ) : typeof this.props.schema.sendFirstByClick === 'boolean' ? (
                        I18n.t('jc_Click to show')
                    ) : (
                        this.getText(this.props.schema.sendFirstByClick, this.props.schema.noTranslation)
                    )}
                </div>
            );
        }

        if (this.state.image === undefined) {
            return null;
        }

        return (
            <Icon
                title={this.getText(this.props.schema.tooltip)}
                src={this.state.image}
                style={{ width: this.props.schema.width || '100%', height: this.props.schema.height }}
            />
        );
    }
}
