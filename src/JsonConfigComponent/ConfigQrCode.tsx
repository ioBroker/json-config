import React, { type JSX } from 'react';

import type QRCode from 'react-qr-code';
import type { ConfigItemQrCode } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';

interface ConfigQrCodeProps extends ConfigGenericProps {
    schema: ConfigItemQrCode;
}

interface ConfigQrCodeState extends ConfigGenericState {
    QRCode: typeof QRCode | null;
}

export default class ConfigQrCode extends ConfigGeneric<ConfigQrCodeProps, ConfigQrCodeState> {
    async componentDidMount(): Promise<void> {
        super.componentDidMount();
        // lazy load of qrcode
        const module = await import('react-qr-code');
        this.setState({ QRCode: module.default });
    }

    renderItem(): JSX.Element | null {
        const QRCodeComponent = this.state.QRCode;
        if (!QRCodeComponent) {
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
                    value={this.props.schema.data}
                    size={this.props.schema.size}
                    fgColor={this.props.schema.fgColor}
                    bgColor={this.props.schema.bgColor}
                    level={this.props.schema.level}
                />
            </div>
        );
    }
}
