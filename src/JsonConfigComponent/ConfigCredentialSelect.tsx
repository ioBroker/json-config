import React, { type JSX } from 'react';

import {
    InputLabel,
    MenuItem,
    FormControl,
    Select,
    FormHelperText,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Alert,
} from '@mui/material';
import { Add as AddIcon, Check as CheckIcon, Close as CloseIcon } from '@mui/icons-material';

import { I18n, Icon, Utils } from '@iobroker/adapter-react-v5';
import type { ConfigItemCredentialSelect } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';

/** Prefix of all credential object IDs. Synchronized with `@iobroker/adapter-core` (src/credentials.ts) */
const CREDENTIALS_PREFIX = 'system.credentials.';

/** Current version of the credential data format (keep in sync with `@iobroker/adapter-core`). */
const CREDENTIALS_VERSION = 1;

type CredentialType = 'email' | 'cloud' | 'ai' | 'custom';
const CREDENTIAL_TYPES: CredentialType[] = ['email', 'cloud', 'ai', 'custom'];
/** Readable labels for the category selector (translated where a key exists, English fallback otherwise). */
const CREDENTIAL_TYPE_LABELS: Record<CredentialType, string> = {
    email: 'E-mail',
    cloud: 'Cloud',
    ai: 'AI',
    custom: 'Custom',
};

type CredentialForm = 'login' | 'key';

interface CredentialFieldDefinition {
    /** Attribute name in the object's `native` */
    name: string;
    type: 'text' | 'password';
    /** Stored encrypted with the system secret */
    encrypted?: boolean;
    required?: boolean;
    /** Label shown in the create dialog */
    label: string;
}

/** The two credential forms and their fields (keep in sync with admin `credentialTypes.ts`). */
const CREDENTIAL_FORMS: Record<CredentialForm, CredentialFieldDefinition[]> = {
    login: [
        { name: 'login', type: 'text', required: true, label: 'Login' },
        { name: 'password', type: 'password', encrypted: true, required: true, label: 'Password' },
    ],
    key: [{ name: 'key', type: 'password', encrypted: true, required: true, label: 'Key' }],
};

/**
 * SVG paths in a 24x24 viewBox: brand logos from https://simpleicons.org (CC0), the rest Material icons.
 * Kept in sync with admin `CredentialsDialog.tsx`.
 */
const ICON_PATHS = {
    anthropic:
        'M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5527h3.7442L10.5363 3.541Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z',
    chatgpt:
        'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.073zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654 2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z',
    gemini: 'M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81',
    email: 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z',
    login: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
    key: 'M21 10h-8.35A5.99 5.99 0 0 0 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6a5.99 5.99 0 0 0 5.65-4H13l2 2 2-2 2 2 4-4.04L21 10zM7 15c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3z',
};

/** Convert an SVG path to a base64 data URL (the SVG content is pure ASCII, so `btoa` can encode it directly). */
function svgDataUrl(path: string, color: string): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" d="${path}"/></svg>`;
    return `data:image/svg+xml;base64,${window.btoa(svg)}`;
}

/** Icon data URLs per template key — stored in `common.icon` of the created credential and shown in the UI. */
const ICON_DATA: Record<string, string> = {
    anthropic: svgDataUrl(ICON_PATHS.anthropic, '#d97757'),
    chatgpt: svgDataUrl(ICON_PATHS.chatgpt, '#74aa9c'),
    gemini: svgDataUrl(ICON_PATHS.gemini, '#8e75b2'),
    email: svgDataUrl(ICON_PATHS.email, '#2196f3'),
    login: svgDataUrl(ICON_PATHS.login, '#9e9e9e'),
    key: svgDataUrl(ICON_PATHS.key, '#ffc107'),
};

interface CredentialTemplate {
    /** Label shown in the template selector */
    label: string;
    /** Icon (data URL) stored in `common.icon` */
    icon: string;
    /** Form of the credential: login/password or a single key */
    form: CredentialForm;
    /** Fixed category, or null if it follows the schema/user selection */
    type: CredentialType | null;
    /** Proposed unique name */
    name?: string;
}

/** Templates offered in the "Add credential" dialog (a focused subset of the admin's templates). */
const CREDENTIAL_TEMPLATES: Record<string, CredentialTemplate> = {
    anthropic: { label: 'Anthropic', icon: ICON_DATA.anthropic, form: 'key', type: 'ai', name: 'anthropic' },
    chatgpt: { label: 'ChatGPT', icon: ICON_DATA.chatgpt, form: 'key', type: 'ai', name: 'chatgpt' },
    gemini: { label: 'Google Gemini', icon: ICON_DATA.gemini, form: 'key', type: 'ai', name: 'gemini' },
    email: { label: 'E-mail', icon: ICON_DATA.email, form: 'login', type: 'email' },
    login: { label: 'Login & password', icon: ICON_DATA.login, form: 'login', type: null },
    key: { label: 'Key', icon: ICON_DATA.key, form: 'key', type: null },
};

interface ConfigCredentialSelectProps extends ConfigGenericProps {
    schema: ConfigItemCredentialSelect;
}

interface CredentialSelectOption {
    label: string;
    value: string;
    /** Icon of the credential (data URL from `common.icon`) */
    icon?: string;
}

interface ConfigCredentialSelectState extends ConfigGenericState {
    selectOptions?: CredentialSelectOption[];
    /** Whether the "create credential" dialog is open */
    addOpen?: boolean;
    /** Selected template key */
    addTemplate?: string;
    addName?: string;
    addType?: CredentialType;
    addFields?: Record<string, string>;
    addError?: string;
    addSaving?: boolean;
}

function renderCredentialItem(
    option: CredentialSelectOption | undefined,
    label: string,
    anyIcon: boolean,
): JSX.Element {
    return (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {option?.icon ? (
                <Icon
                    src={option.icon}
                    style={{ width: 20, height: 20 }}
                />
            ) : anyIcon ? (
                // if at least one option has an icon, keep the labels aligned
                <span style={{ width: 20, height: 20, flexShrink: 0 }} />
            ) : null}
            {label}
        </span>
    );
}

export default class ConfigCredentialSelect extends ConfigGeneric<
    ConfigCredentialSelectProps,
    ConfigCredentialSelectState
> {
    async componentDidMount(): Promise<void> {
        await super.componentDidMount();
        const value = ConfigGeneric.getValue(this.props.data, this.props.attr);

        const selectOptions = await this.readCredentials();
        this.setState({ value, selectOptions });
    }

    /**
     * Read the credential objects ("system.credentials.<name>") and turn them into select options,
     * filtered by `schema.credentialType` if set. The "none" option is prepended.
     */
    async readCredentials(): Promise<CredentialSelectOption[]> {
        let selectOptions: CredentialSelectOption[] = [];
        try {
            const objs = await this.props.oContext.socket.getObjectViewSystem(
                'config',
                CREDENTIALS_PREFIX,
                `${CREDENTIALS_PREFIX}香`,
            );
            selectOptions = Object.values(objs)
                .filter(
                    obj =>
                        !!obj &&
                        (!this.props.schema.credentialType ||
                            (obj.native as Record<string, any>)?.type === this.props.schema.credentialType),
                )
                .map(obj => ({
                    label: ConfigCredentialSelect.getCredentialName(obj as ioBroker.Object),
                    value: obj._id,
                    icon: typeof obj.common?.icon === 'string' ? obj.common.icon : undefined,
                }))
                .sort((a, b) => a.label.localeCompare(b.label));
        } catch (e) {
            console.error(`Cannot read credentials: ${e}`);
        }

        selectOptions.unshift({ label: I18n.t(ConfigGeneric.NONE_LABEL), value: ConfigGeneric.NONE_VALUE });
        return selectOptions;
    }

    static getCredentialName(obj: ioBroker.Object): string {
        const name = obj.common?.name;
        let text: string;
        if (name && typeof name === 'object') {
            text = name[I18n.getLanguage()] || name.en || Object.values(name)[0] || '';
        } else {
            text = (name as string) || '';
        }
        return text || obj._id.substring(CREDENTIALS_PREFIX.length);
    }

    /** Template keys offered for this field, filtered by `schema.credentialType` (type-agnostic ones always shown). */
    templateKeys(): string[] {
        const credentialType = this.props.schema.credentialType;
        return Object.keys(CREDENTIAL_TEMPLATES).filter(key => {
            const template = CREDENTIAL_TEMPLATES[key];
            return !credentialType || template.type === credentialType || template.type === null;
        });
    }

    /** Apply a template: it defines the form, the (proposed) name, the category and the icon. */
    selectTemplate(key: string): void {
        const template = CREDENTIAL_TEMPLATES[key];
        this.setState({
            addTemplate: key,
            addName: template.name || '',
            addType: template.type || this.props.schema.credentialType || 'custom',
            addFields: {},
            addError: '',
        });
    }

    /** Open the create dialog, pre-selecting the first template that fits the schema's credentialType. */
    openAddDialog(): void {
        const keys = this.templateKeys();
        const addTemplate = keys[0];
        const template = CREDENTIAL_TEMPLATES[addTemplate];
        this.setState({
            addOpen: true,
            addTemplate,
            addName: template.name || '',
            addType: template.type || this.props.schema.credentialType || 'custom',
            addFields: {},
            addError: '',
            addSaving: false,
        });
    }

    /** Create the credential object, encrypt its secret fields, store it (with icon), then select it. */
    async createCredential(): Promise<void> {
        const template = CREDENTIAL_TEMPLATES[this.state.addTemplate || ''];
        const name = (this.state.addName || '').trim().replace(Utils.FORBIDDEN_CHARS, '_');
        if (!name) {
            this.setState({ addError: I18n.t('A unique name is required') });
            return;
        }
        const id = `${CREDENTIALS_PREFIX}${name}`;
        if ((this.state.selectOptions || []).find(option => option.value === id)) {
            this.setState({ addError: I18n.t('A credential with this name already exists') });
            return;
        }

        const form = template?.form || 'login';
        const fields = CREDENTIAL_FORMS[form];
        const addFields = this.state.addFields || {};
        if (fields.some(field => field.required && !(addFields[field.name] || '').trim())) {
            this.setState({ addError: I18n.t('Please fill in all required fields') });
            return;
        }
        const type: CredentialType =
            template?.type || this.props.schema.credentialType || this.state.addType || 'custom';

        this.setState({ addSaving: true, addError: '' });
        try {
            // The actual socket is always an AdminConnection at runtime (only admin can write credentials);
            // `encrypt` uses the system secret, exactly as the admin "Credentials" dialog does.
            const socket = this.props.oContext.socket;
            const native: Record<string, any> = {
                type,
                version: CREDENTIALS_VERSION,
                encryptedFields: fields.filter(field => field.encrypted).map(field => field.name),
            };
            for (const field of fields) {
                const raw = addFields[field.name] || '';
                native[field.name] = field.encrypted && raw ? await socket.encrypt(raw) : raw;
            }

            const obj = {
                _id: id,
                type: 'config',
                common: { name, ...(template?.icon ? { icon: template.icon } : {}) },
                native,
                // Only the admin may read credentials.
                acl: {
                    object: 0x600,
                    owner: 'system.user.admin',
                    ownerGroup: 'system.group.administrator',
                },
            } as unknown as ioBroker.SettableObject;

            await socket.setObject(id, obj);

            // Insert the new credential into the options (keeping "none" on top), then select it.
            const existing = this.state.selectOptions || [];
            const none = existing.find(option => option.value === ConfigGeneric.NONE_VALUE);
            const rest = existing.filter(option => option.value !== ConfigGeneric.NONE_VALUE);
            rest.push({ label: name, value: id, icon: template?.icon });
            rest.sort((a, b) => a.label.localeCompare(b.label));
            const selectOptions = none ? [none, ...rest] : rest;

            this.setState({ addOpen: false, addSaving: false, selectOptions, value: id }, () =>
                this.onChange(this.props.attr, id),
            );
        } catch (e) {
            this.setState({
                addSaving: false,
                addError: I18n.t('Cannot create credential: %s', (e as Error).toString()),
            });
        }
    }

    renderAddDialog(): JSX.Element | null {
        if (!this.state.addOpen) {
            return null;
        }
        const template = CREDENTIAL_TEMPLATES[this.state.addTemplate || ''];
        const form = template?.form || 'login';
        const fields = CREDENTIAL_FORMS[form];
        const id = `${CREDENTIALS_PREFIX}${(this.state.addName || '').trim().replace(Utils.FORBIDDEN_CHARS, '_')}`;
        // The category can only be chosen for type-agnostic templates when the schema doesn't pin a type.
        const showCategory = !this.props.schema.credentialType && template?.type === null;

        return (
            <Dialog
                open
                maxWidth="sm"
                fullWidth
                onClose={() => this.setState({ addOpen: false })}
            >
                <DialogTitle>{I18n.t('Add credential')}</DialogTitle>
                <DialogContent style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
                    <FormControl
                        fullWidth
                        variant="standard"
                    >
                        <InputLabel shrink>{I18n.t('Template')}</InputLabel>
                        <Select
                            variant="standard"
                            value={this.state.addTemplate || ''}
                            onChange={e => this.selectTemplate(e.target.value)}
                        >
                            {this.templateKeys().map(key => (
                                <MenuItem
                                    key={key}
                                    value={key}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <img
                                            src={CREDENTIAL_TEMPLATES[key].icon}
                                            width={20}
                                            height={20}
                                            alt=""
                                        />
                                        {I18n.t(CREDENTIAL_TEMPLATES[key].label)}
                                    </span>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {showCategory ? (
                        <FormControl
                            fullWidth
                            variant="standard"
                        >
                            <InputLabel shrink>{I18n.t('Credential type')}</InputLabel>
                            <Select
                                variant="standard"
                                value={this.state.addType || 'custom'}
                                onChange={e => this.setState({ addType: e.target.value as CredentialType })}
                            >
                                {CREDENTIAL_TYPES.map(type => (
                                    <MenuItem
                                        key={type}
                                        value={type}
                                    >
                                        {I18n.t(CREDENTIAL_TYPE_LABELS[type])}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    ) : null}

                    <TextField
                        variant="standard"
                        fullWidth
                        label={I18n.t('ra_Name')}
                        value={this.state.addName || ''}
                        error={!!this.state.addError}
                        helperText={this.state.addName ? id : ''}
                        slotProps={{ inputLabel: { shrink: true }, htmlInput: { autoComplete: 'off' } }}
                        onChange={e => this.setState({ addName: e.target.value, addError: '' })}
                    />

                    {fields.map(field => (
                        <TextField
                            key={field.name}
                            variant="standard"
                            fullWidth
                            type={field.type === 'password' ? 'password' : 'text'}
                            required={field.required}
                            label={I18n.t(field.label)}
                            value={this.state.addFields?.[field.name] || ''}
                            slotProps={{
                                inputLabel: { shrink: true },
                                htmlInput: { autoComplete: field.type === 'password' ? 'new-password' : 'off' },
                            }}
                            onChange={e =>
                                this.setState({
                                    addFields: { ...(this.state.addFields || {}), [field.name]: e.target.value },
                                    addError: '',
                                })
                            }
                        />
                    ))}

                    {this.state.addError ? <Alert severity="error">{this.state.addError}</Alert> : null}
                </DialogContent>
                <DialogActions>
                    <Button
                        variant="contained"
                        color="primary"
                        disabled={!!this.state.addSaving || !(this.state.addName || '').trim()}
                        startIcon={<CheckIcon />}
                        onClick={() => this.createCredential()}
                    >
                        {I18n.t('ra_Create')}
                    </Button>
                    <Button
                        variant="contained"
                        color="grey"
                        disabled={!!this.state.addSaving}
                        startIcon={<CloseIcon />}
                        onClick={() => this.setState({ addOpen: false })}
                    >
                        {I18n.t('ra_Cancel')}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }

    renderItem(error: unknown, disabled: boolean /* , defaultValue */): JSX.Element | null {
        if (!this.state.selectOptions) {
            return null;
        }

        const item = this.state.selectOptions?.find(_item => _item.value === this.state.value);
        // The stored value could point to a meanwhile deleted credential
        const unknownValue =
            this.state.value && this.state.value !== ConfigGeneric.NONE_VALUE && !item ? this.state.value : null;
        // if at least one option has an icon, options without icon get a placeholder for alignment
        const anyIcon = this.state.selectOptions.some(option => !!option.icon);
        // creation can be suppressed per schema (`disableCreation`)
        const canCreate = !this.props.schema.disableCreation;

        return (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, width: '100%' }}>
                <FormControl
                    style={{ flex: 1, minWidth: 0 }}
                    variant="standard"
                >
                    {this.props.schema.label ? (
                        <InputLabel shrink>{this.getText(this.props.schema.label)}</InputLabel>
                    ) : null}
                    <Select
                        variant="standard"
                        error={!!error || !!unknownValue}
                        displayEmpty
                        disabled={!!disabled}
                        value={this.state.value || ConfigGeneric.NONE_VALUE}
                        renderValue={() =>
                            unknownValue
                                ? unknownValue
                                : renderCredentialItem(
                                      item,
                                      this.getText(item?.label, this.props.schema.noTranslation !== false),
                                      anyIcon,
                                  )
                        }
                        onChange={e =>
                            this.setState(
                                { value: e.target.value === ConfigGeneric.NONE_VALUE ? '' : e.target.value },
                                () => this.onChange(this.props.attr, this.state.value),
                            )
                        }
                    >
                        {this.state.selectOptions?.map(item_ => (
                            <MenuItem
                                key={item_.value}
                                value={item_.value}
                                style={item_.value === ConfigGeneric.NONE_VALUE ? { opacity: 0.5 } : {}}
                            >
                                {renderCredentialItem(
                                    item_,
                                    this.getText(item_.label, this.props.schema.noTranslation !== false),
                                    anyIcon,
                                )}
                            </MenuItem>
                        ))}
                    </Select>
                    {this.props.schema.help ? (
                        <FormHelperText>
                            {this.renderHelp(
                                this.props.schema.help,
                                this.props.schema.helpLink,
                                this.props.schema.noTranslation,
                            )}
                        </FormHelperText>
                    ) : null}
                </FormControl>
                {canCreate ? (
                    <IconButton
                        size="small"
                        disabled={!!disabled}
                        title={I18n.t('Add credential')}
                        onClick={() => this.openAddDialog()}
                    >
                        <AddIcon />
                    </IconButton>
                ) : null}
                {this.renderAddDialog()}
            </div>
        );
    }
}
