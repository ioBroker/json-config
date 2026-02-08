import React, { type JSX } from 'react';

import type { ConfigItemIFrameSendTo } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';

interface ConfigIFrameSendToProps extends ConfigGenericProps {
    schema: ConfigItemIFrameSendTo;
}

interface ConfigIFrameSendToState extends ConfigGenericState {
    url?: string;
    isVisible?: boolean;
}

export default class ConfigIFrameSendTo extends ConfigGeneric<ConfigIFrameSendToProps, ConfigIFrameSendToState> {
    private initialized = false;

    private localContext: string | undefined;

    private iframeRef = React.createRef<HTMLIFrameElement>();
    private observer: IntersectionObserver | null = null;

    componentDidMount(): void {
        super.componentDidMount();

        this.askInstance();

        if (this.props.schema.reloadOnShow) {
            this.observer = new IntersectionObserver(([entry]) => {
                if (entry.isIntersecting && this.state.isVisible === false && this.iframeRef.current) {
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

            void this.props.oContext.socket
                .sendTo(
                    `${this.props.oContext.adapterName}.${this.props.oContext.instance}`,
                    this.props.schema.command || 'send',
                    data,
                )
                .then(url => this.setState({ url: url || '' }));
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

    renderItem(error: boolean, disabled: boolean /*, defaultValue */): JSX.Element {
        if (this.props.alive) {
            const localContext = this.getContext();
            if (localContext !== this.localContext || !this.initialized) {
                this.localContext = localContext;
                setTimeout(() => this.askInstance(), this.initialized ? 300 : 50);
                this.initialized = true;
            }
        }

        if (this.state.url === undefined) {
            return null;
        }

        return (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <iframe
                    style={{
                        width: '100%',
                        height: '100%',
                        borderWidth: this.props.schema.frameBorder ?? 0,
                        ...this.props.schema.innerStyle,
                        border: error ? '1px solid red' : undefined,
                    }}
                    ref={this.iframeRef}
                    src={this.state.url}
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
