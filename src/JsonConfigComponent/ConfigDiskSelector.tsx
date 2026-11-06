import React, { type JSX } from 'react';

import {
    Box,
    Breadcrumbs,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    InputAdornment,
    LinearProgress,
    Link,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    ArrowUpward as IconUp,
    ChevronRight as IconEnter,
    Computer as IconDrives,
    Folder as IconDir,
    InsertDriveFileOutlined as IconFileEntry,
    Search as IconSearch,
} from '@mui/icons-material';

import { I18n, IconFolder, IconRefresh, Utils } from '@iobroker/gui-components';

import type { ConfigItemDiskSelector } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';

/** The feature flag of js-controller for the host command `readDiskDir` */
const FEATURE = 'CONTROLLER_READ_DISK_DIR';

/** How long to wait for the answer of the host */
const TIMEOUT_MS = 15_000;

/** The error of the socket server, if the user may not send the command */
const PERMISSION_ERROR = 'permissionError';

/** One entry of a listed directory, as the host answers it */
interface DiskDirEntry {
    name: string;
    /** Absolute path on the host */
    path: string;
    isDir: boolean;
    /** Only files */
    size?: number;
    /** ms */
    modified?: number;
}

/** The answer of the host command `readDiskDir` of js-controller */
interface DiskDirAnswer {
    error?: string;
    /** The resolved root, `''` for the drives on Windows */
    root: string;
    /** The listed directory, `''` for the drives on Windows */
    path: string;
    /** `null` at the root */
    parent: string | null;
    crumbs: { name: string; path: string }[];
    entries: DiskDirEntry[];
    /** Name of the file the requested path pointed to */
    selected?: string;
    truncated?: boolean;
    sep: string;
}

/** The hosts that can list their disk: asked once per host */
const supportedHosts: Record<string, boolean> = {};

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
    toolbar: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        minHeight: 40,
    },
    crumbs: {
        flexGrow: 1,
        overflow: 'hidden',
    },
    crumb: {
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        whiteSpace: 'nowrap',
    },
    list: {
        height: 'min(55vh, 520px)',
        overflowY: 'auto',
        padding: 0,
    },
    hint: {
        padding: 16,
        opacity: 0.7,
    },
    selected: {
        flexGrow: 1,
        fontFamily: 'monospace',
        fontSize: 13,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        paddingLeft: 16,
        paddingRight: 8,
        opacity: 0.8,
    },
    entryText: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
};

interface ConfigDiskSelectorProps extends ConfigGenericProps {
    schema: ConfigItemDiskSelector;
}

interface ConfigDiskSelectorState extends ConfigGenericState {
    showDialog?: boolean;
    /** The listed directory */
    dir?: DiskDirAnswer | null;
    loading?: boolean;
    /** Why the directory could not be listed */
    dialogError?: string;
    /** The clicked entry. None: in the folder mode the listed folder is selected */
    selected?: DiskDirEntry | null;
    /** Shows only the entries of the listed directory that contain this text */
    quickFilter?: string;
}

/**
 * Selects a file or a folder on the disk of the host where the instance runs.
 *
 * The host lists the directories (`sendToHost('readDiskDir')` of js-controller), as the user ioBroker runs as: what
 * this user may not read is not shown. The socket server lets only users with the permission for `cmdExec` send it.
 */
export default class ConfigDiskSelector extends ConfigGeneric<ConfigDiskSelectorProps, ConfigDiskSelectorState> {
    /** Only the answer to the last request is shown, if the user clicks faster than the host answers */
    private requestId = 0;

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

    /** The host of the instance, whose disk is shown */
    getHost(): string {
        return this.props.common?.host || '';
    }

    isFolderMode(): boolean {
        return this.props.schema.mode === 'folder';
    }

    /**
     * Send an event to the socket server and wait for its answer, at most {@link TIMEOUT_MS}
     *
     * @param event name of the event, e.g. `sendToHost`
     * @param args the arguments before the callback
     */
    emit<T>(event: string, ...args: any[]): Promise<T[]> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS);
            this.props.oContext.socket.getRawSocket().emit(event, ...args, (...result: T[]) => {
                clearTimeout(timer);
                resolve(result);
            });
        });
    }

    /** Throws a message to show, if the host cannot list its disk */
    async checkSupported(host: string): Promise<void> {
        if (supportedHosts[host]) {
            return;
        }
        let supported: boolean | undefined;
        try {
            const [error, isSupported] = await this.emit<any>('checkFeatureSupportedByHost', host, FEATURE);
            if (!error) {
                supported = !!isSupported;
            }
        } catch {
            // no answer
        }
        if (supported === undefined) {
            throw new Error(I18n.t('jc_Host "%s" is offline or does not answer', host));
        }
        if (!supported) {
            throw new Error(I18n.t('jc_Host "%s" cannot list its disk. Update js-controller on this host', host));
        }
        supportedHosts[host] = true;
    }

    /** The root as the adapter wrote it, with the number of the instance */
    getRoot(): string {
        return (this.props.schema.root || '').replace(/%INSTANCE%/g, (this.props.oContext.instance || 0).toString());
    }

    /**
     * List a directory of the host and show it in the dialog
     *
     * @param path absolute path of the directory, or of a file to list its directory. Empty: the root
     */
    async readDir(path: string): Promise<void> {
        const requestId = ++this.requestId;
        this.setState({ loading: true });

        let dir: DiskDirAnswer | null = null;
        let dialogError = '';
        try {
            const host = this.getHost();
            if (!host) {
                throw new Error(I18n.t('jc_The host of the instance is unknown'));
            }
            await this.checkSupported(host);
            const [answer] = await this.emit<DiskDirAnswer>('sendToHost', host, 'readDiskDir', {
                root: this.getRoot(),
                path,
                dirsOnly: this.isFolderMode(),
                filter: this.isFolderMode() ? undefined : this.props.schema.pattern,
                showHidden: !!this.props.schema.showHidden,
                instance: `${this.props.oContext.adapterName}.${this.props.oContext.instance || 0}`,
            });
            if (answer?.error === PERMISSION_ERROR) {
                throw new Error(I18n.t('jc_You have no permission to read the disk of the host'));
            }
            if (!answer || !Array.isArray(answer.entries)) {
                throw new Error(answer?.error || I18n.t('jc_No answer from the host'));
            }
            if (answer.error) {
                dialogError = I18n.t('jc_Cannot read the folder: %s', answer.error);
            }
            dir = answer;
        } catch (e) {
            dialogError =
                e instanceof Error && e.message === 'timeout'
                    ? I18n.t('jc_Host "%s" is offline or does not answer', this.getHost())
                    : e instanceof Error
                      ? e.message
                      : String(e);
        }

        if (requestId !== this.requestId) {
            return;
        }

        // the file of the current value
        const selected = (dir?.selected && dir.entries.find(entry => entry.name === dir.selected)) || null;
        this.setState({ loading: false, dir, dialogError, selected, quickFilter: '' });
    }

    openDialog(): void {
        this.setState({ showDialog: true, dir: null, dialogError: '', selected: null, quickFilter: '' }, () =>
            this.readDir((this.state.value || '').toString().trim()),
        );
    }

    closeDialog(): void {
        // an answer that still comes is not shown anymore
        this.requestId++;
        this.setState({ showDialog: false, loading: false });
    }

    /**
     * What the button "Select" takes: the clicked entry, or in the folder mode the listed folder.
     * A folder in the file mode is opened instead.
     */
    getSelection(): { path: string; open?: boolean } | null {
        const selected = this.state.selected;
        if (selected) {
            return { path: selected.path, open: selected.isDir && !this.isFolderMode() };
        }
        if (this.isFolderMode() && this.state.dir?.path && !this.state.dialogError) {
            return { path: this.state.dir.path };
        }
        return null;
    }

    select(path: string): void {
        this.closeDialog();
        if (path && path !== this.state.value) {
            this.setState({ value: path }, () => this.onChange(this.props.attr, path));
        }
    }

    /** A double click opens a folder and takes a file, like in the file dialogs of the operating systems */
    onEntryDoubleClick(entry: DiskDirEntry): void {
        if (entry.isDir) {
            void this.readDir(entry.path);
        } else {
            this.select(entry.path);
        }
    }

    renderCrumbs(): JSX.Element | null {
        const dir = this.state.dir;
        if (!dir?.crumbs?.length) {
            return <div style={styles.crumbs} />;
        }
        return (
            <Breadcrumbs
                style={styles.crumbs}
                maxItems={6}
                itemsBeforeCollapse={1}
                itemsAfterCollapse={4}
            >
                {dir.crumbs.map((crumb, i) => {
                    const last = i === dir.crumbs.length - 1;
                    // on Windows the list of drives is above the drives
                    const label = crumb.path ? (
                        // the root can be long: its last part, the whole path is the title
                        i === 0 && dir.root ? (
                            crumb.name.split(dir.sep).filter(Boolean).pop() || crumb.name
                        ) : (
                            crumb.name
                        )
                    ) : (
                        <>
                            <IconDrives fontSize="small" />
                            {I18n.t('jc_Drives')}
                        </>
                    );
                    if (last) {
                        return (
                            <Typography
                                key={crumb.path}
                                component="span"
                                color="text.primary"
                                style={styles.crumb}
                                title={crumb.path}
                            >
                                {label}
                            </Typography>
                        );
                    }
                    return (
                        <Link
                            key={crumb.path}
                            component="button"
                            underline="hover"
                            color="inherit"
                            style={styles.crumb}
                            title={crumb.path}
                            onClick={() => this.readDir(crumb.path)}
                        >
                            {label}
                        </Link>
                    );
                })}
            </Breadcrumbs>
        );
    }

    renderEntry(entry: DiskDirEntry): JSX.Element {
        const details: string[] = [];
        if (!entry.isDir && entry.size !== undefined) {
            details.push(Utils.formatBytes(entry.size));
        }
        if (entry.modified) {
            details.push(new Date(entry.modified).toLocaleString());
        }

        return (
            <ListItemButton
                key={entry.path}
                dense
                selected={entry.path === this.state.selected?.path}
                onClick={() => this.setState({ selected: entry })}
                onDoubleClick={() => this.onEntryDoubleClick(entry)}
            >
                <ListItemIcon style={{ minWidth: 36 }}>
                    {entry.isDir ? <IconDir color="primary" /> : <IconFileEntry />}
                </ListItemIcon>
                <ListItemText
                    primary={entry.name}
                    secondary={details.join(' · ') || undefined}
                    slotProps={{
                        primary: { style: styles.entryText },
                        secondary: { style: styles.entryText },
                    }}
                />
                {/* opens the folder with one click */}
                {entry.isDir ? (
                    <Tooltip
                        title={I18n.t('jc_Open')}
                        slotProps={{ popper: { sx: { pointerEvents: 'none' } } }}
                    >
                        <IconButton
                            size="small"
                            edge="end"
                            onClick={e => {
                                e.stopPropagation();
                                void this.readDir(entry.path);
                            }}
                        >
                            <IconEnter />
                        </IconButton>
                    </Tooltip>
                ) : null}
            </ListItemButton>
        );
    }

    renderList(): JSX.Element {
        const dir = this.state.dir;
        if (!dir) {
            return <div style={styles.list} />;
        }
        const quickFilter = (this.state.quickFilter || '').toLowerCase();
        const entries = quickFilter
            ? dir.entries.filter(entry => entry.name.toLowerCase().includes(quickFilter))
            : dir.entries;

        let hint: string | null = null;
        if (!dir.entries.length && !this.state.dialogError) {
            hint = I18n.t('jc_The folder is empty');
        } else if (!entries.length && quickFilter) {
            hint = I18n.t('jc_All items are filtered out');
        }

        return (
            <List style={styles.list}>
                {entries.map(entry => this.renderEntry(entry))}
                {hint ? <div style={styles.hint}>{hint}</div> : null}
                {dir.truncated ? (
                    <div style={styles.hint}>
                        {I18n.t('jc_Only the first %s entries are shown', dir.entries.length)}
                    </div>
                ) : null}
            </List>
        );
    }

    renderDialog(): JSX.Element | null {
        if (!this.state.showDialog) {
            return null;
        }
        const folderMode = this.isFolderMode();
        const selection = this.getSelection();
        const title = this.props.schema.label
            ? this.getText(this.props.schema.label)
            : I18n.t(folderMode ? 'jc_Select folder' : 'jc_Select file');

        return (
            <Dialog
                open={!0}
                maxWidth="md"
                fullWidth
                onClose={() => this.closeDialog()}
            >
                <DialogTitle>
                    {title}
                    <Typography
                        component="span"
                        style={{ marginLeft: 8, opacity: 0.6, fontSize: 'smaller' }}
                    >
                        {this.getHost()}
                    </Typography>
                </DialogTitle>
                <DialogContent style={{ paddingBottom: 0 }}>
                    <div style={styles.toolbar}>
                        <Tooltip
                            title={I18n.t('jc_One level up')}
                            slotProps={{ popper: { sx: { pointerEvents: 'none' } } }}
                        >
                            <span>
                                <IconButton
                                    size="small"
                                    disabled={this.state.dir?.parent === null || this.state.dir?.parent === undefined}
                                    onClick={() => this.readDir(this.state.dir?.parent || '')}
                                >
                                    <IconUp />
                                </IconButton>
                            </span>
                        </Tooltip>
                        {this.renderCrumbs()}
                        <TextField
                            variant="standard"
                            size="small"
                            style={{ width: 160 }}
                            value={this.state.quickFilter || ''}
                            placeholder={I18n.t('jc_Filter')}
                            onChange={e => this.setState({ quickFilter: e.target.value })}
                            slotProps={{
                                input: {
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <IconSearch fontSize="small" />
                                        </InputAdornment>
                                    ),
                                },
                            }}
                        />
                        <Tooltip
                            title={I18n.t('jc_Refresh')}
                            slotProps={{ popper: { sx: { pointerEvents: 'none' } } }}
                        >
                            <span>
                                <IconButton
                                    size="small"
                                    disabled={!!this.state.loading}
                                    onClick={() => this.readDir(this.state.dir?.path || '')}
                                >
                                    <IconRefresh
                                        loading={!!this.state.loading}
                                        showDone={false}
                                    />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </div>
                    <Box style={{ height: 4 }}>{this.state.loading ? <LinearProgress /> : null}</Box>
                    {this.state.dialogError ? (
                        <Typography
                            color="error"
                            style={{ padding: '8px 0' }}
                        >
                            {this.state.dialogError}
                        </Typography>
                    ) : null}
                    {this.renderList()}
                </DialogContent>
                <DialogActions>
                    <div
                        style={styles.selected}
                        title={selection?.path}
                    >
                        {selection?.path}
                    </div>
                    <Button
                        variant="contained"
                        disabled={!selection || !!this.state.loading}
                        onClick={() => {
                            if (selection?.open) {
                                void this.readDir(selection.path);
                            } else if (selection) {
                                this.select(selection.path);
                            }
                        }}
                    >
                        {I18n.t(selection?.open ? 'jc_Open' : 'jc_Select')}
                    </Button>
                    <Button
                        variant="contained"
                        color="grey"
                        onClick={() => this.closeDialog()}
                    >
                        {I18n.t('jc_Cancel')}
                    </Button>
                </DialogActions>
            </Dialog>
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
                            onClick={() => this.openDialog()}
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
