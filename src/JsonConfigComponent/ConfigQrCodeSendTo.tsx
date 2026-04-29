import React, { type JSX } from 'react';

import { CircularProgress } from '@mui/material';
import { I18n } from '@iobroker/adapter-react-v5';

import type QRCode from 'react-qr-code';
import type { ConfigItemQrCodeSendTo } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';

interface ConfigQrCodeSendToProps extends ConfigGenericProps {
    schema: ConfigItemQrCodeSendTo;
}

interface ConfigQrCodeSendToState extends ConfigGenericState {
    qrData?: string;
    loading?: boolean;
    QRCode: typeof QRCode | null;
}

export default class ConfigQrCodeSendTo extends ConfigGeneric<ConfigQrCodeSendToProps, ConfigQrCodeSendToState> {
    private initialized = false;

    private localContext: string | undefined;

    async componentDidMount(): Promise<void> {
        super.componentDidMount();
        const module = await import('react-qr-code');
        this.setState({ QRCode: module.default });
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
            const instance = this.getPattern(
                this.props.schema.instance || `${this.props.oContext.adapterName}.${this.props.oContext.instance}`,
            );
            this.setState({ loading: true }, () =>
                this.props.oContext.socket
                    .sendTo(instance, this.props.schema.command || 'send', data)
                    .then(qrData => this.setState({ qrData: qrData || '', loading: false })),
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

    renderItem(): JSX.Element | null {
        if (this.props.alive) {
            const localContext = this.getContext();
            if (localContext !== this.localContext || !this.initialized) {
                this.localContext = localContext;
                if (!this.props.schema.sendFirstByClick || this.state.qrData !== undefined) {
                    setTimeout(() => this.askInstance(), this.initialized ? 300 : 50);
                }
                this.initialized = true;
            }
        }

        if (!this.state.qrData && this.props.schema.sendFirstByClick) {
            return (
                <div
                    style={{
                        width: '100%',
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
                        I18n.t('ra_Click to show')
                    ) : (
                        this.getText(this.props.schema.sendFirstByClick, this.props.schema.noTranslation)
                    )}
                </div>
            );
        }

        const QRCodeComponent = this.state.QRCode;
        if (!QRCodeComponent || this.state.qrData === undefined) {
            return null;
        }
        // Quiet zone: QR spec (ISO 18004) requires min 4 modules.
        // ~15% of size ensures sufficient quiet zone, minimum 32px
        const padding = Math.max(32, Math.round((this.props.schema.size || 256) * 0.15));

        return (
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: this.props.schema.bgColor || 'white',
                    padding,
                    width: '100%',
                    height: '100%',
                }}
            >
                <QRCodeComponent
                    title={this.getText(this.props.schema.tooltip)}
                    value={this.state.qrData}
                    size={this.props.schema.size}
                    fgColor={this.props.schema.fgColor}
                    bgColor={this.props.schema.bgColor}
                    level={this.props.schema.level}
                />
            </div>
        );
    }
}
