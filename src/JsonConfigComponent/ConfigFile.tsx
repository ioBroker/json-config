import React, { type JSX } from 'react';

import { Button, TextField, IconButton } from '@mui/material';

import { Article as IconText, Code as IconCode, Videocam as IconVideo } from '@mui/icons-material';

import { DialogSelectFile, I18n, IconPlayPause } from '@iobroker/gui-components';

import type { ConfigItemFile } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
import { playBase64Audio } from './audioPlayer';

const styles: Record<string, React.CSSProperties> = {
    fullWidth: {
        width: '100%',
    },
    fullWidthOneButton: {
        width: 'calc(100% - 69px)',
        marginRight: 4,
    },
    fullWidthIcon: {
        width: 'calc(100% - 119px)',
        marginRight: 4,
    },
    selectedImage: {
        height: 40,
        width: 40,
        display: 'inline-block',
        marginRight: 8,
    },
};

const IMAGE_EXT = ['jpg', 'jpeg', 'svg', 'png', 'webp', 'gif', 'apng', 'avif', 'webp'];
const AUDIO_EXT = ['mp3', 'ogg', 'wav', 'aac'];
const VIDEO_EXT = ['avi', 'mp4', 'mov'];
const DOC_EXT = ['txt', 'log', 'html', 'htm'];
const JS_EXT = ['json', 'js', 'ts'];

interface ConfigFileProps extends ConfigGenericProps {
    schema: ConfigItemFile;
}

interface ConfigFileState extends ConfigGenericState {
    showFileBrowser?: boolean;
    /** The sound is being loaded or plays */
    playing?: 'loading' | 'playing';
}

export default class ConfigFile extends ConfigGeneric<ConfigFileProps, ConfigFileState> {
    private imagePrefix = '../..';

    /** Stops the sound that plays */
    private stopAudio: (() => void) | null = null;

    componentWillUnmount(): void {
        this.stopAudio?.();
        super.componentWillUnmount();
    }

    async componentDidMount(): Promise<void> {
        await super.componentDidMount();
        const value = ConfigGeneric.getValue(this.props.data, this.props.attr);
        this.imagePrefix = this.props.oContext.imagePrefix ?? './files';
        this.setState({ value: value ?? '' });
    }

    static getDerivedStateFromProps(props: ConfigFileProps, state: ConfigFileState): Partial<ConfigFileState> | null {
        const value = ConfigGeneric.getValue(props.data, props.attr);
        if (
            value === null ||
            value === undefined ||
            value.toString().trim() !== (state.value || '').toString().trim()
        ) {
            return { value: value ?? '' };
        }
        return null;
    }

    loadFile(): Promise<{ file: string; mimeType: string } | null> {
        const pos = this.state.value.indexOf('/');
        if (pos !== -1) {
            const adapter = this.state.value.substring(0, pos);
            const path = this.state.value.substring(pos + 1);
            return this.props.oContext.socket.readFile(adapter, path, true);
        }

        return Promise.resolve(null);
    }

    /** Plays the sound, or stops it if it plays. The button shows pause meanwhile. */
    togglePlay(): void {
        if (this.stopAudio) {
            // `onEnded` resets the button
            this.stopAudio();
            return;
        }
        if (this.state.playing) {
            // still loading
            return;
        }
        let ended = false;
        this.setState({ playing: 'loading' });
        this.loadFile()
            .then(data =>
                data?.file
                    ? playBase64Audio(data.file, () => {
                          ended = true;
                          this.stopAudio = null;
                          this.setState({ playing: undefined });
                      })
                    : null,
            )
            .then(stop => {
                if (!stop) {
                    this.setState({ playing: undefined });
                } else if (!ended) {
                    this.stopAudio = stop;
                    this.setState({ playing: 'playing' });
                }
            })
            .catch((err: Error) => {
                this.setState({ playing: undefined });
                window.alert(I18n.t('jc_Cannot play: %s', err?.message || String(err)));
            });
    }

    getIcon(): JSX.Element | null {
        const extension = this.state.value.split('.').pop().toLowerCase();
        if (IMAGE_EXT.includes(extension)) {
            return (
                <div
                    style={{
                        ...styles.selectedImage,
                        backgroundImage: `url(${this.imagePrefix}/${this.state.value})`,
                        backgroundSize: 'contain',
                        backgroundRepeat: 'no-repeat',
                    }}
                />
            );
        }
        if (AUDIO_EXT.includes(extension)) {
            return (
                <IconButton
                    style={{ color: '#00FF00' }}
                    onClick={() => this.togglePlay()}
                >
                    {/* pause while the sound plays: a click stops it */}
                    <IconPlayPause
                        running={this.state.playing === 'playing'}
                        pending={this.state.playing === 'loading'}
                    />
                </IconButton>
            );
        }
        if (DOC_EXT.includes(extension)) {
            return <IconText />;
        }
        if (VIDEO_EXT.includes(extension)) {
            return <IconVideo />;
        }
        if (JS_EXT.includes(extension)) {
            return <IconCode />;
        }
        return null;
    }

    renderFileBrowser(): JSX.Element | null {
        if (!this.state.showFileBrowser) {
            return null;
        }
        return (
            <DialogSelectFile
                imagePrefix={this.props.oContext.imagePrefix}
                socket={this.props.oContext.socket}
                selected={this.state.value}
                onClose={() => this.setState({ showFileBrowser: false })}
                onOk={_value => {
                    const value = Array.isArray(_value) ? _value[0] : _value;
                    this.setState(
                        { value },
                        () =>
                            this.props.attr &&
                            this.onChange(
                                this.props.attr,
                                this.props.schema.trim === false ? value : (value || '').trim(),
                            ),
                    );
                }}
                selectOnlyFolders={this.props.schema.selectOnlyFolders}
                allowUpload={this.props.schema.allowUpload}
                allowDownload={this.props.schema.allowDownload}
                allowCreateFolder={this.props.schema.allowCreateFolder}
                allowView={this.props.schema.allowView}
                showToolbar={this.props.schema.showToolbar}
                limitPath={this.props.schema.limitPath}
                theme={this.props.oContext.theme}
            />
        );
    }

    renderItem(error: string, disabled: boolean /* , defaultValue */): JSX.Element {
        const icon = this.getIcon();

        return (
            <div style={styles.fullWidth}>
                {icon}
                <TextField
                    variant="standard"
                    style={icon ? styles.fullWidthIcon : styles.fullWidthOneButton}
                    value={this.state.value ?? ''}
                    error={!!error}
                    disabled={!!disabled}
                    slotProps={{
                        htmlInput: {
                            maxLength: this.props.schema.maxLength || this.props.schema.max || undefined,
                            readOnly: !!this.props.schema.disableEdit,
                        },
                    }}
                    onChange={e => {
                        const value = e.target.value;
                        this.setState(
                            { value },
                            () =>
                                this.props.attr &&
                                this.onChange(
                                    this.props.attr,
                                    this.props.schema.trim === false ? value : (value || '').trim(),
                                ),
                        );
                    }}
                    placeholder={this.getText(this.props.schema.placeholder)}
                    label={this.getText(this.props.schema.label)}
                    helperText={this.renderHelp(
                        this.props.schema.help,
                        this.props.schema.helpLink,
                        this.props.schema.noTranslation,
                    )}
                />
                <Button
                    disabled={disabled}
                    variant="outlined"
                    onClick={() => this.setState({ showFileBrowser: true })}
                >
                    ...
                </Button>
                {this.renderFileBrowser()}
            </div>
        );
    }
}
