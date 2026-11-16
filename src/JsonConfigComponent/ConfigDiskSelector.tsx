import React, { type JSX } from 'react';

import { IconButton, TextField, Tooltip } from '@mui/material';

import { DialogSelectDiskPath, I18n, IconFolder } from '@iobroker/gui-components';

import type { ConfigItemDiskSelector } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';

const styles: Record<string, React.CSSProperties> = {
    root: {
        display: 'flex',
        alignItems: 'flex-start',
        width: '100%',
    },
    text: {
        flexGrow: 1,
    },
    browse: {
        marginTop: 8,
    },
};

interface ConfigDiskSelectorProps extends ConfigGenericProps {
    schema: ConfigItemDiskSelector;
}

interface ConfigDiskSelectorState extends ConfigGenericState {
    showDialog?: boolean;
}

/**
 * Selects a file or a folder on the disk of the host where the instance runs.
 *
 * The dialog is `DialogSelectDiskPath` of `@iobroker/gui-components`: the host lists the directories
 * (`sendToHost('readDiskDir')` of js-controller), as the user ioBroker runs as.
 */
export default class ConfigDiskSelector extends ConfigGeneric<ConfigDiskSelectorProps, ConfigDiskSelectorState> {
    async componentDidMount(): Promise<void> {
        await super.componentDidMount();
        const value = ConfigGeneric.getValue(this.props.data, this.props.attr);
        this.setState({ value: value ?? '' });
    }

    static getDerivedStateFromProps(
        props: ConfigDiskSelectorProps,
        state: ConfigDiskSelectorState,
    ): Partial<ConfigDiskSelectorState> | null {
        const value = ConfigGeneric.getValue(props.data, props.attr) ?? '';
        // the stored path is trimmed, the typed one not yet: a space at the end must stay while typing
        if (value.toString().trim() !== (state.value ?? '').toString().trim()) {
            return { value };
        }
        return null;
    }

    isFolderMode(): boolean {
        return this.props.schema.mode === 'folder';
    }

    renderDialog(): JSX.Element | null {
        if (!this.state.showDialog) {
            return null;
        }
        const instance = (this.props.oContext.instance || 0).toString();

        return (
            <DialogSelectDiskPath
                socket={this.props.oContext.socket}
                host={this.props.common?.host || ''}
                mode={this.isFolderMode() ? 'folder' : 'file'}
                selected={(this.state.value || '').toString()}
                // the root as the adapter wrote it, with the number of the instance
                root={(this.props.schema.root || '').replace(/%INSTANCE%/g, instance)}
                pattern={this.props.schema.pattern}
                showHidden={!!this.props.schema.showHidden}
                instance={`${this.props.oContext.adapterName}.${instance}`}
                title={this.props.schema.label ? this.getText(this.props.schema.label) : undefined}
                onOk={path => {
                    if (path && path !== this.state.value) {
                        this.setState({ value: path }, () => this.onChange(this.props.attr, path));
                    }
                }}
                onClose={() => this.setState({ showDialog: false })}
            />
        );
    }

    renderItem(error: string, disabled: boolean /* , defaultValue */): JSX.Element {
        // with a root a typed path could lead out of it, so it is only selected by default
        const disableEdit = this.props.schema.disableEdit ?? !!this.props.schema.root;

        return (
            <div style={styles.root}>
                <TextField
                    variant="standard"
                    style={styles.text}
                    value={this.state.value ?? ''}
                    error={!!error}
                    disabled={!!disabled}
                    slotProps={{
                        htmlInput: { readOnly: disableEdit },
                    }}
                    onChange={e => {
                        const value = e.target.value.trim();
                        this.setState({ value: e.target.value }, () => this.onChange(this.props.attr, value));
                    }}
                    placeholder={this.getText(this.props.schema.placeholder)}
                    label={this.getText(this.props.schema.label)}
                    helperText={this.renderHelp(
                        this.props.schema.help,
                        this.props.schema.helpLink,
                        this.props.schema.noTranslation,
                    )}
                />
                <Tooltip
                    title={I18n.t(this.isFolderMode() ? 'jc_Select folder' : 'jc_Select file')}
                    slotProps={{ popper: { sx: { pointerEvents: 'none' } } }}
                >
                    <span style={styles.browse}>
                        <IconButton
                            disabled={!!disabled}
                            onClick={() => this.setState({ showDialog: true })}
                        >
                            {/* opens while the dialog is shown */}
                            <IconFolder open={!!this.state.showDialog} />
                        </IconButton>
                    </span>
                </Tooltip>
                {this.renderDialog()}
            </div>
        );
    }
}
