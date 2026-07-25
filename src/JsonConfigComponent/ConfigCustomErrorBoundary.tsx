import React, { type JSX } from 'react';

import { InfoBox, I18n } from '@iobroker/gui-components';

interface ConfigCustomErrorBoundaryProps {
    /** Component name as defined in the schema: `<remote>/<file>/<Component>` */
    name: string;
    /** URL the remote was loaded from */
    url?: string;
    children: React.ReactNode;
}

interface ConfigCustomErrorBoundaryState {
    error: Error | null;
}

/**
 * Catches render errors of custom components that adapters provide via module federation.
 *
 * A custom component is third-party code built against a specific generation of
 * `@iobroker/gui-components` / `@iobroker/json-config`. One built against an older generation
 * (React 18 / MUI 6) can throw while rendering inside a newer admin, because it calls APIs that
 * no longer exist. Without this boundary React unmounts the whole tree on such a throw, so a
 * single outdated adapter would blank the entire configuration page.
 *
 * Note that error boundaries only catch errors thrown while rendering, in lifecycle methods and
 * in constructors of the subtree below them. Errors from event handlers or async callbacks are
 * not caught here; failures while *loading* a remote are handled in `ConfigCustom`.
 */
export default class ConfigCustomErrorBoundary extends React.Component<
    ConfigCustomErrorBoundaryProps,
    ConfigCustomErrorBoundaryState
> {
    constructor(props: ConfigCustomErrorBoundaryProps) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error: Error): ConfigCustomErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo): void {
        console.error(
            `Custom component "${this.props.name}" from "${this.props.url || 'unknown URL'}" crashed while rendering. ` +
                `It was probably built for an older admin version.`,
            error,
            info.componentStack,
        );
    }

    componentDidUpdate(prevProps: ConfigCustomErrorBoundaryProps): void {
        // A different component deserves a fresh attempt, otherwise it would inherit the error state
        if (this.state.error && (prevProps.name !== this.props.name || prevProps.url !== this.props.url)) {
            this.setState({ error: null });
        }
    }

    render(): JSX.Element {
        if (!this.state.error) {
            return <>{this.props.children}</>;
        }

        return (
            <InfoBox
                type="error"
                iconPosition="top"
            >
                <div>
                    <div style={{ fontWeight: 'bold' }}>
                        {I18n.t('jc_Cannot display the custom component "%s"', this.props.name)}
                    </div>
                    <div>
                        {I18n.t('jc_It was probably built for an older admin version. Please update the adapter.')}
                    </div>
                    <div style={{ marginTop: 8, fontStyle: 'italic', wordBreak: 'break-word' }}>
                        {this.state.error.message || String(this.state.error)}
                    </div>
                </div>
            </InfoBox>
        );
    }
}
