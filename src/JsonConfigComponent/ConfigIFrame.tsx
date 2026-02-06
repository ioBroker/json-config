import React, { type JSX } from 'react';

import type { ConfigItemIFrame } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';

interface ConfigIFrameProps extends ConfigGenericProps {
    schema: ConfigItemIFrame;
}

interface ConfigIFrameState extends ConfigGenericState {
    isVisible?: boolean;
}

export default class ConfigIFrame extends ConfigGeneric<ConfigIFrameProps, ConfigIFrameState> {
    private iframeRef = React.createRef<HTMLIFrameElement>();
    private observer: IntersectionObserver | null = null;

    componentDidMount(): void {
        super.componentDidMount();

        if (this.props.schema.reloadOnShow) {
            this.observer = new IntersectionObserver(([entry]) => {
                if (entry.isIntersecting && this.state.isVisible && this.iframeRef.current) {
                    const currentSrc = this.iframeRef.current.src;
                    this.iframeRef.current.src = '';
                    setTimeout(() => {
                        if (this.iframeRef.current) {
                            this.iframeRef.current.src = currentSrc;
                        }
                    }, 0);
                }
                this.setState({ isVisible: entry.isIntersecting });
            });
            if (this.iframeRef.current) {
                this.observer.observe(this.iframeRef.current);
            }
        }
    }

    componentWillUnmount(): void {
        super.componentWillUnmount?.();
        this.observer?.disconnect();
    }

    renderItem(error: boolean, disabled: boolean /* , defaultValue */): JSX.Element {
        const url = this.props.schema.url || ConfigGeneric.getValue(this.props.data, this.props.attr);

        return (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <iframe
                    style={{
                        width: '100%',
                        height: '100%',
                        ...this.props.schema.innerStyle,
                        border: error ? '1px solid red' : undefined,
                    }}
                    ref={this.iframeRef}
                    src={url}
                    allowFullScreen={this.props.schema.allowFullscreen ?? false}
                    sandbox={this.props.schema.sandbox}
                    loading={this.props.schema.lazyLoad ?? 'lazy'}
                />
                {disabled && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            backgroundColor: 'rgba(255, 255, 255, 0.3)',
                            cursor: 'not-allowed',
                            zIndex: 1,
                        }}
                    />
                )}
            </div>
        );
    }
}
