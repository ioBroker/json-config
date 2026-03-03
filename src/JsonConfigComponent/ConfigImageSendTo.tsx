import React, { type JSX } from 'react';

import { CircularProgress } from '@mui/material';
import { I18n } from '@iobroker/adapter-react-v5';

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

    componentDidMount(): void {
        super.componentDidMount();

        if (!this.props.schema.sendFirstByClick) {
            this.askInstance();
        }
    }

    askInstance(): void {
        if (this.props.alive) {
            let data = this.props.schema.data;
            if (data === undefined && this.props.schema.jsonData) {
                const dataStr: string = this.getPattern(this.props.schema.jsonData, null, true);
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
            this.setState({ loading: true }, () =>
                this.props.oContext.socket
                    .sendTo(
                        `${this.props.oContext.adapterName}.${this.props.oContext.instance}`,
                        this.props.schema.command || 'send',
                        data,
                    )
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
                    }}
                    onClick={() => !this.state.loading && this.askInstance()}
                >
                    {this.state.loading ? (
                        <CircularProgress />
                    ) : typeof this.props.schema.sendFirstByClick === 'boolean' ? (
                        I18n.t('ra_Click to show')
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
            <img
                alt="dynamic content"
                src={this.state.image}
                style={{ width: this.props.schema.width || '100%', height: this.props.schema.height }}
            />
        );
    }
}
