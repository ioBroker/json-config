import React, { type JSX } from 'react';
import Dropzone, { type DropzoneRef } from 'react-dropzone';

import {
    InputLabel,
    MenuItem,
    FormHelperText,
    FormControl,
    Select,
    IconButton,
    ListItemText,
    ListItemIcon,
    Box,
} from '@mui/material';
import { alpha } from '@mui/material/styles';

import {
    MusicNote as IconAudio,
    Videocam as IconVideo,
    Article as IconText,
    Code as IconCode,
} from '@mui/icons-material';

import {
    DialogConfirm,
    IconPlayPause,
    IconRefresh,
    IconTrash,
    IconUpload,
    Utils,
    I18n,
    type IobTheme,
} from '@iobroker/gui-components';

import type { ConfigItemFileSelector } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
import { base64ToArrayBuffer, playBase64Audio } from './audioPlayer';

const styles: Record<string, React.CSSProperties> = {
    fullWidth: {
        width: '100%',
    },
    fullWidthOneButton: {
        width: 'calc(100% - 42px)',
    },
    fullWidthTwoButtons: {
        width: 'calc(100% - 84px)',
    },
    fullWidthThreeButtons: {
        width: 'calc(100% - 126x)',
    },
    dropZone: {
        width: '100%',
        height: '100%',
        position: 'absolute',
    },
    dropZoneEmpty: {},
    image: {
        objectFit: 'contain',
        margin: 'auto',
        display: 'flex',
        width: '100%',
        height: '100%',
    },
    uploadDiv: {
        position: 'relative',
        width: '100%',
    },
    uploadDivDragging: {
        opacity: 1,
        background: 'rgba(128,255,128,0.1)',
    },
    uploadCenterText: {
        fontSize: 16,
    },
    /** The drop area has only the height of the selector: icon and text side by side */
    uploadCenterTextAndIcon: {
        textAlign: 'center',
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    disabledOpacity: {
        opacity: 0.3,
        cursor: 'default',
    },
    error: {
        border: '2px solid red',
    },
    deleteButton: {},
    selectedImage: {
        height: 40,
        width: 40,
        display: 'inline-block',
        marginRight: 8,
    },
};

/** Drop area over the selector while a file is dragged over it: its border pulses */
const uploadCenterDivSx = (theme: IobTheme, error?: boolean): Record<string, any> => ({
    border: error ? '2px solid red' : `3px dashed ${theme.palette.primary.main}`,
    borderRadius: '5px',
    // over the whole selector including its buttons, but not wider
    position: 'absolute',
    inset: 0,
    boxSizing: 'border-box',
    display: 'flex',
    zIndex: 1,
    // the text must be readable over the value of the selector
    backgroundColor: alpha(theme.palette.background.paper, 0.9),
    animation: 'jc-file-drop-pulse 1.2s ease-in-out infinite',
    '@keyframes jc-file-drop-pulse': {
        '0%': { boxShadow: `0 0 0 0 ${alpha(theme.palette.primary.main, 0.4)}` },
        '70%, 100%': { boxShadow: `0 0 0 10px ${alpha(theme.palette.primary.main, 0)}` },
    },
    '@media (prefers-reduced-motion: reduce)': {
        animation: 'none',
    },
});

const IMAGE_EXT = ['jpg', 'jpeg', 'svg', 'png', 'webp', 'gif', 'apng', 'avif', 'webp'];
const AUDIO_EXT = ['mp3', 'ogg', 'wav', 'aac'];
const VIDEO_EXT = ['avi', 'mp4', 'mov'];
const DOC_EXT = ['txt', 'log', 'html', 'htm'];
const JS_EXT = ['json', 'js', 'ts'];

interface ConfigFileSelectorProps extends ConfigGenericProps {
    attr: string;
    schema: ConfigItemFileSelector;
}

interface ConfigFileSelectorState extends ConfigGenericState {
    uploadFile?: boolean | 'dragging';
    uploadError?: boolean;
    files?: { name: string; size: string }[];
    deleteFile: string;
    /** The dropped file is being uploaded: the upload arrow moves up */
    uploading?: boolean;
    /** The refresh button was clicked and the files are read: the refresh symbol turns */
    refreshing?: boolean;
    /** The sound is being loaded or plays */
    playing?: 'loading' | 'playing';
}

export default class ConfigFileSelector extends ConfigGeneric<ConfigFileSelectorProps, ConfigFileSelectorState> {
    private readonly dropzoneRef: React.RefObject<DropzoneRef | null>;

    private readonly imagePrefix: string;

    private objectID!: string;

    private path!: string;

    /** Stops the sound that plays */
    private stopAudio: (() => void) | null = null;

    constructor(props: ConfigFileSelectorProps) {
        super(props);
        this.state = {
            ...this.state,
            deleteFile: '',
        };
        this.dropzoneRef = React.createRef();
        this.imagePrefix = this.props.oContext.imagePrefix ?? './files';
    }

    async componentDidMount(): Promise<void> {
        await super.componentDidMount();

        this.objectID = (this.props.schema.objectID || '0_userdata.0').replace(
            '%INSTANCE%',
            (this.props.oContext.instance || 0).toString(),
        );
        this.path = this.props.schema.upload || '';
        if (this.path) {
            if (this.path === '/') {
                this.path = '';
            } else if (!this.path.endsWith('/')) {
                this.path = `${this.path}/`;
            }
        }

        // read files
        void this.updateFiles().then(() => {
            const value = ConfigGeneric.getValue(this.props.data, this.props.attr);
            this.setState({ value });
            // subscribe to this folder
            this.props.oContext.socket
                .subscribeFiles(this.objectID, `${this.path}/*`, this.onFolderChanged)
                .catch(e => console.error(`Cannot subscribe: ${e}`));
        });
    }

    onFolderChanged = (_id: string, fileName: string): void => {
        if (this.path && fileName.startsWith(this.path)) {
            this.updateFiles().catch(e => console.error(`Cannot update files: ${e}`));
        }
    };

    componentWillUnmount(): void {
        // it subscribed here before instead of unsubscribing, so every remount added one more handler
        if (this.objectID) {
            this.props.oContext.socket.unsubscribeFiles(this.objectID, `${this.path}/*`, this.onFolderChanged);
        }
        this.stopAudio?.();

        super.componentWillUnmount();
    }

    /** The patterns of the schema: several patterns are separated by `|`, e.g. `ttsVoices/*.onnx|ttsVoices/*.json` */
    getPatterns(): string[] {
        const patterns = (this.props.schema.pattern || '')
            .split('|')
            .map(pattern => pattern.trim())
            .filter(pattern => pattern);
        return patterns.length ? patterns : ['**/*.*'];
    }

    async updateFiles(): Promise<void> {
        const files = await this.readFiles();
        await new Promise<void>(resolve => this.setState({ files }, resolve));
    }

    /** Reads the files again; the refresh button turns meanwhile */
    refresh(): void {
        this.setState({ refreshing: true }, () =>
            this.updateFiles()
                .catch(e => console.error(`Cannot update files: ${e}`))
                .finally(() => this.setState({ refreshing: false })),
        );
    }

    /** Checks if the file name (without folder) matches the filter of a pattern, like `*.onnx` */
    static matchFilter(fileName: string, filter: string): boolean {
        if (filter === '*.*' && fileName.includes('.')) {
            return true;
        }
        if (!filter || filter === '*') {
            return true;
        }
        if (filter === '.*' && fileName.startsWith('.')) {
            return true;
        }
        const regExp = new RegExp(`^${filter.replace(/\./g, '\\.').replace(/\*/g, '.*')}$`);
        return regExp.test(fileName);
    }

    async readFolder(
        folderName: string,
        files: { name: string; size: string }[],
        filter: string,
    ): Promise<{ name: string; size: string }[]> {
        try {
            const dirFiles = await this.props.oContext.socket.readDir(this.objectID, folderName.replace(/^\//, ''));
            for (let f = 0; f < dirFiles.length; f++) {
                const file = dirFiles[f];
                if (file.isDir) {
                    // read it
                    await this.readFolder(`${folderName + file.file}/`, files, filter);
                } else if (ConfigFileSelector.matchFilter(file.file, filter)) {
                    files.push({
                        name: folderName + file.file,
                        size: file.stats?.size ? Utils.formatBytes(file.stats.size) : '--',
                    });
                }
            }
        } catch (e) {
            console.error(`Cannot read "${folderName}": ${e}`);
        }

        return files;
    }

    /** Reads the files of all patterns (or of the given ones); a file found by several patterns is listed once */
    async readFiles(patterns?: string[]): Promise<{ name: string; size: string }[]> {
        const files: { name: string; size: string }[] = [];
        for (const pattern of patterns || this.getPatterns()) {
            const patternFiles: { name: string; size: string }[] = [];
            let filter;
            const pos = pattern.lastIndexOf('/');
            if (pos === -1) {
                filter = pattern;
            } else {
                filter = pattern.substring(pos + 1);
            }

            if (pattern.startsWith('**')) {
                // read all folders
                await this.readFolder('/', patternFiles, filter);
            } else {
                const pos_ = pattern.lastIndexOf('/');
                if (pos_ === -1) {
                    await this.readFolder('/', patternFiles, filter);
                } else {
                    const folder = pattern.substring(0, pos_ + 1);
                    await this.readFolder(folder, patternFiles, filter);
                }
            }
            patternFiles.forEach(file => {
                if (!files.find(f => f.name === file.name)) {
                    files.push(file);
                }
            });
        }

        return files;
    }

    static readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onabort = () => reject(new Error(`Reading of ${file.name} was aborted`));
            reader.onerror = () => reject(new Error(`Cannot read file ${file.name}`));
            reader.onload = (): void => {
                if (reader.result === null) {
                    reject(new Error(`Cannot read file ${file.name}`));
                } else {
                    resolve(reader.result as ArrayBuffer);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }

    /** Uploads all dropped files one after another, then selects the first one that matches the first pattern */
    async onDrop(acceptedFiles: File[]): Promise<void> {
        const maxSize = this.props.schema.maxSize || 2 * 1024 * 1024;
        const files = acceptedFiles.filter(file => {
            if (file.size > maxSize) {
                window.alert(I18n.t('jc_File is too big. Max %sk allowed. Try use SVG.', Math.round(maxSize / 1024)));
                return false;
            }
            return true;
        });
        if (!files.length) {
            return;
        }

        // the upload button shows the progress: the arrow moves up while uploading, then a check mark or a cross
        this.setState({ uploading: true });
        const uploaded: string[] = [];
        try {
            for (const file of files) {
                const content = await ConfigFileSelector.readFileAsArrayBuffer(file);
                await this.props.oContext.socket.writeFile64(this.objectID, this.path + file.name, content);
                uploaded.push(this.path + file.name);
            }
        } catch (e) {
            console.error(`Cannot upload file: ${e}`);
            window.alert(I18n.t('jc_Cannot upload file: %s', String(e)));
        }

        try {
            await this.updateFiles();
        } catch (e) {
            console.error(`Cannot update files: ${e}`);
        }

        if (!uploaded.length) {
            this.setState({ uploading: false });
            this.showActionResult('error');
            return;
        }
        this.showActionResult(uploaded.length === files.length ? 'success' : 'error');

        // Automatically select the new uploaded file: the first one that matches the first pattern
        const firstPattern = this.getPatterns()[0];
        const filter = firstPattern.substring(firstPattern.lastIndexOf('/') + 1);
        const value =
            uploaded.find(name => ConfigFileSelector.matchFilter(name.split('/').pop() || '', filter)) || uploaded[0];
        this.setState({ uploading: false, value }, () => this.onChange(this.props.attr, value));
    }

    renderDeleteDialog(): JSX.Element | null {
        if (!this.state.deleteFile) {
            return null;
        }
        return (
            <DialogConfirm
                title={I18n.t('jc_Are you sure?')}
                text={I18n.t('jc_File will be deleted')}
                ok={I18n.t('jc_Delete')}
                cancel={I18n.t('jc_Cancel')}
                onClose={isOk => {
                    const deleteFile = this.state.deleteFile;
                    this.setState({ deleteFile: '' }, () => {
                        if (isOk) {
                            this.props.oContext.socket
                                .deleteFile(this.objectID, deleteFile)
                                .then(() => this.updateFiles())
                                .catch(e => window.alert(I18n.t('jc_Cannot delete file: %s', String(e))));
                        }
                    });
                }}
            />
        );
    }

    static base64ToArrayBuffer(base64: string): ArrayBufferLike {
        return base64ToArrayBuffer(base64);
    }

    loadFile(): Promise<{ file: string; mimeType: string }> {
        return this.props.oContext.socket.readFile(this.objectID, this.state.value, true);
    }

    /** Plays the selected sound, or stops it if it plays. The button shows pause meanwhile. */
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
                playBase64Audio(data.file, () => {
                    ended = true;
                    this.stopAudio = null;
                    this.setState({ playing: undefined });
                }),
            )
            .then(stop => {
                if (!ended) {
                    this.stopAudio = stop;
                    this.setState({ playing: 'playing' });
                }
            })
            .catch((err: Error) => {
                this.setState({ playing: undefined });
                window.alert(I18n.t('jc_Cannot play: %s', err?.message || String(err)));
            });
    }

    getFileIcon(item: { value: string; label: string; extension?: string } | undefined | null): JSX.Element | null {
        if (!item?.extension) {
            return null;
        }
        if (IMAGE_EXT.includes(item.extension)) {
            return (
                <div
                    style={{
                        ...styles.selectedImage,
                        backgroundImage: `url(${this.imagePrefix}/${this.objectID}/${item.value})`,
                        backgroundSize: 'contain',
                        backgroundRepeat: 'no-repeat',
                    }}
                />
            );
        }
        if (AUDIO_EXT.includes(item.extension)) {
            return <IconAudio />;
        }
        if (DOC_EXT.includes(item.extension)) {
            return <IconText />;
        }
        if (VIDEO_EXT.includes(item.extension)) {
            return <IconVideo />;
        }
        if (JS_EXT.includes(item.extension)) {
            return <IconCode />;
        }
        return null;
    }

    /** The files that the upload accepts for one pattern, e.g. `{ '*\/*': ['.onnx'] }` for `ttsVoices/*.onnx*` */
    static getAccept(pattern: string): Record<string, string[]> {
        const last = (pattern.split('/').pop() || '')
            .toLowerCase()
            .replace(/.*\./, '')
            .replace(/\*+$/, '');
        if (!last) {
            return { '*/*': [] };
        }
        if (
            last === 'png' ||
            last === 'jpg' ||
            last === 'svg' ||
            last === 'gif' ||
            last === 'apng' ||
            last === 'avif' ||
            last === 'webp'
        ) {
            return {
                'image/*': ['.png', '.jpg', '.svg', '.gif', '.apng', '.avif', '.webp'],
            };
        }
        if (last === 'mp3' || last === 'ogg' || last === 'wav') {
            return {
                'audio/*': ['.mp3', '.ogg', '.wav', '.mp4'],
            };
        }
        if (last === 'ics') {
            return {
                'text/calendar': ['.ics'],
            };
        }
        if (last === 'txt') {
            return {
                'text/plain': ['.txt'],
            };
        }
        if (last === 'pem') {
            return {
                'text/plain': ['.pem'],
            };
        }
        return {
            '*/*': [`.${last}`],
        };
    }

    renderItem(error: string, disabled: boolean /* , defaultValue */): JSX.Element | null {
        if (!this.state.files) {
            return null;
        }
        const folders: string[] = [];
        if (!this.props.schema.withFolder) {
            this.state.files.forEach(file => {
                const pos = file.name.lastIndexOf('/');
                if (pos === -1) {
                    if (!folders.includes('/')) {
                        folders.push('/');
                    }
                } else {
                    const folder = file.name.substring(0, pos + 1);
                    if (!folders.includes(folder)) {
                        folders.push(folder);
                    }
                }
            });
        }

        const selectOptions: { value: string; label: string; extension?: string }[] = this.state.files.map(file => ({
            value: file.name,
            label:
                !this.props.schema.withFolder && folders.length === 1
                    ? `${file.name.substring(folders[0].length)}`
                    : `${file.name}${this.props.schema.noSize ? '' : `(${file.size})`}`,
            extension: file.name.toLowerCase().split('.').pop(),
        }));

        if (!this.props.schema.noNone) {
            selectOptions.unshift({ label: I18n.t('jc_none'), value: '' });
        }

        const item: { value: string; label: string; extension?: string } | undefined = selectOptions.find(
            _item => _item.value === this.state.value,
        );

        let buttons = 0;

        if (this.props.schema.upload) {
            buttons++;
        }
        if (this.props.schema.refresh) {
            buttons++;
        }
        const play =
            this.state.value &&
            (this.state.value.endsWith('.mp3') ||
                this.state.value.endsWith('.ogg') ||
                this.state.value.endsWith('.wav'));
        // show play button
        if (play) {
            buttons++;
        }

        const element = (
            <div style={styles.fullWidth}>
                <FormControl
                    variant="standard"
                    style={{ width: `calc(100% - ${buttons * 42}px)` }}
                >
                    {this.props.schema.label ? <InputLabel>{this.getText(this.props.schema.label)}</InputLabel> : null}
                    <Select
                        variant="standard"
                        error={!!error}
                        disabled={!!disabled}
                        value={this.state.value || '_'}
                        renderValue={() => (
                            <>
                                {this.getFileIcon(item)}
                                <span>{item?.label || ''}</span>
                            </>
                        )}
                        onChange={e => {
                            // the play button belongs to the previous file
                            this.stopAudio?.();
                            this.setState({ value: e.target.value === '_' ? '' : e.target.value }, () =>
                                this.onChange(this.props.attr, this.state.value),
                            );
                        }}
                    >
                        {selectOptions.map(it => (
                            <MenuItem
                                key={it.value}
                                value={it.value}
                            >
                                <ListItemIcon>{this.getFileIcon(it)}</ListItemIcon>
                                <ListItemText>{it.label}</ListItemText>
                                {this.props.schema.delete && it.value ? (
                                    <IconButton
                                        style={styles.deleteButton}
                                        size="small"
                                        onClick={e => {
                                            e.stopPropagation();
                                            this.setState({ deleteFile: it.value });
                                        }}
                                    >
                                        {/* the lid stays open while the deletion is confirmed */}
                                        <IconTrash open={this.state.deleteFile === it.value} />
                                    </IconButton>
                                ) : null}
                            </MenuItem>
                        ))}
                    </Select>
                    {this.props.schema.help || this.getValidatorErrorText() ? (
                        <FormHelperText>
                            {this.renderHelp(
                                this.props.schema.help,
                                this.props.schema.helpLink,
                                this.props.schema.noTranslation,
                            )}
                        </FormHelperText>
                    ) : null}
                </FormControl>
                {this.props.schema.refresh && (
                    <IconButton
                        disabled={!!this.state.refreshing}
                        onClick={() => this.refresh()}
                    >
                        <IconRefresh loading={!!this.state.refreshing} />
                    </IconButton>
                )}
                {this.props.schema.upload && (
                    <IconButton
                        disabled={!!this.state.uploading}
                        onClick={() => this.dropzoneRef.current?.open()}
                    >
                        {/* the arrow moves up while uploading, then the result draws itself */}
                        {this.renderActionResult() || <IconUpload uploading={!!this.state.uploading} />}
                    </IconButton>
                )}
                {play && (
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
                )}
            </div>
        );

        if (!this.props.schema.upload) {
            return (
                <>
                    {element}
                    {this.renderDeleteDialog()}
                </>
            );
        }
        let accept: Record<string, string[]> = { '*/*': [] };
        if (this.props.schema.fileTypes === 'image') {
            accept = {
                'image/*': ['.png', '.jpg', '.svg', '.gif', '.apng', '.avif', '.webp'],
            };
        } else if (this.props.schema.fileTypes === 'audio') {
            accept = {
                'audio/*': ['.mp3', '.ogg', '.wav', '.mp4'],
            };
        } else if (this.props.schema.fileTypes === 'text') {
            accept = {
                'text/plain': ['.txt'],
            };
        }
        if (this.props.schema.pattern) {
            // every pattern adds its extension, e.g. `ttsVoices/*.onnx|ttsVoices/*.json`
            const accepts = this.getPatterns().map(pattern => ConfigFileSelector.getAccept(pattern));
            if (accepts.length === 1) {
                accept = accepts[0];
            } else if (accepts.some(a => a['*/*'] && !a['*/*'].length)) {
                // one pattern allows all files
                accept = { '*/*': [] };
            } else {
                accept = {};
                accepts.forEach(a =>
                    Object.keys(a).forEach(mime => {
                        accept[mime] ||= [];
                        a[mime].forEach(ext => {
                            if (!accept[mime].includes(ext)) {
                                accept[mime].push(ext);
                            }
                        });
                    }),
                );
            }
        }

        return (
            <Dropzone
                ref={this.dropzoneRef}
                multiple={!!this.props.schema.multipleUpload}
                accept={accept}
                noKeyboard
                noClick
                maxSize={this.props.schema.maxSize || 2 * 1024 * 1024}
                onDragEnter={() => {
                    this.setState({ uploadFile: 'dragging' });
                }}
                onDragLeave={() => this.setState({ uploadFile: true })}
                onDrop={(acceptedFiles, errors) => {
                    this.setState({ uploadFile: false });
                    if (!acceptedFiles.length) {
                        window.alert(errors?.[0]?.errors?.[0]?.message || I18n.t('jc_Cannot upload'));
                    } else {
                        void this.onDrop(acceptedFiles);
                    }
                }}
            >
                {({ getRootProps, getInputProps }) => (
                    <div
                        style={{
                            ...styles.uploadDiv,
                            ...(this.state.uploadFile === 'dragging' ? styles.uploadDivDragging : undefined),
                            ...(disabled ? styles.disabledOpacity : undefined),
                        }}
                        {...getRootProps()}
                    >
                        <input {...getInputProps()} />
                        {this.state.uploadFile === 'dragging' ? (
                            <Box sx={uploadCenterDivSx(this.props.oContext.theme, this.state.uploadError)}>
                                <div style={styles.uploadCenterTextAndIcon}>
                                    {/* bobs while the file is over the drop area */}
                                    <IconUpload
                                        ready
                                        fontSize={28}
                                    />
                                    <div style={styles.uploadCenterText}>
                                        {this.state.uploadFile === 'dragging'
                                            ? I18n.t('jc_Drop file here')
                                            : I18n.t(
                                                  'jc_Place your files here or click here to open the browse dialog',
                                              )}
                                    </div>
                                </div>
                            </Box>
                        ) : null}
                        {element}
                        {this.renderDeleteDialog()}
                    </div>
                )}
            </Dropzone>
        );
    }
}
