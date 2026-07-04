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

type CredentialType = 'email' | 'cloud' | 'ai' | 'aws' | 'azure' | 'custom';
const CREDENTIAL_TYPES: CredentialType[] = ['email', 'cloud', 'ai', 'aws', 'azure', 'custom'];
/** Readable labels for the category selector (translated where a key exists, English fallback otherwise). */
const CREDENTIAL_TYPE_LABELS: Record<CredentialType, string> = {
    email: 'E-mail',
    cloud: 'Cloud',
    ai: 'AI',
    aws: 'AWS',
    azure: 'Azure',
    custom: 'Custom',
};

type CredentialForm = 'login' | 'key' | 'aws' | 'azure';

interface CredentialFieldOption {
    /** Value stored in `native` */
    value: string;
    /** Text shown in the dropdown (defaults to `value`) */
    label?: string;
}

interface CredentialFieldDefinition {
    /** Attribute name in the object's `native` */
    name: string;
    type: 'text' | 'password' | 'select';
    /** Stored encrypted with the system secret */
    encrypted?: boolean;
    required?: boolean;
    /** Label shown in the create dialog */
    label: string;
    /** For `type: 'select'`: the selectable options */
    options?: CredentialFieldOption[];
}

/** Common AWS regions offered in the region selector (keep in sync with admin `credentialTypes.ts`). */
const AWS_REGIONS: CredentialFieldOption[] = [
    { value: 'us-east-1', label: 'us-east-1 (US East, N. Virginia)' },
    { value: 'us-east-2', label: 'us-east-2 (US East, Ohio)' },
    { value: 'us-west-1', label: 'us-west-1 (US West, N. California)' },
    { value: 'us-west-2', label: 'us-west-2 (US West, Oregon)' },
    { value: 'ca-central-1', label: 'ca-central-1 (Canada Central)' },
    { value: 'sa-east-1', label: 'sa-east-1 (South America, São Paulo)' },
    { value: 'eu-west-1', label: 'eu-west-1 (Europe, Ireland)' },
    { value: 'eu-west-2', label: 'eu-west-2 (Europe, London)' },
    { value: 'eu-west-3', label: 'eu-west-3 (Europe, Paris)' },
    { value: 'eu-central-1', label: 'eu-central-1 (Europe, Frankfurt)' },
    { value: 'eu-central-2', label: 'eu-central-2 (Europe, Zurich)' },
    { value: 'eu-north-1', label: 'eu-north-1 (Europe, Stockholm)' },
    { value: 'eu-south-1', label: 'eu-south-1 (Europe, Milan)' },
    { value: 'eu-south-2', label: 'eu-south-2 (Europe, Spain)' },
    { value: 'ap-south-1', label: 'ap-south-1 (Asia Pacific, Mumbai)' },
    { value: 'ap-northeast-1', label: 'ap-northeast-1 (Asia Pacific, Tokyo)' },
    { value: 'ap-northeast-2', label: 'ap-northeast-2 (Asia Pacific, Seoul)' },
    { value: 'ap-northeast-3', label: 'ap-northeast-3 (Asia Pacific, Osaka)' },
    { value: 'ap-southeast-1', label: 'ap-southeast-1 (Asia Pacific, Singapore)' },
    { value: 'ap-southeast-2', label: 'ap-southeast-2 (Asia Pacific, Sydney)' },
    { value: 'me-central-1', label: 'me-central-1 (Middle East, UAE)' },
    { value: 'me-south-1', label: 'me-south-1 (Middle East, Bahrain)' },
    { value: 'af-south-1', label: 'af-south-1 (Africa, Cape Town)' },
];

/** Common Azure regions offered in the region selector (keep in sync with admin `credentialTypes.ts`). */
const AZURE_REGIONS: CredentialFieldOption[] = [
    { value: 'eastus', label: 'eastus (East US)' },
    { value: 'eastus2', label: 'eastus2 (East US 2)' },
    { value: 'centralus', label: 'centralus (Central US)' },
    { value: 'northcentralus', label: 'northcentralus (North Central US)' },
    { value: 'southcentralus', label: 'southcentralus (South Central US)' },
    { value: 'westus', label: 'westus (West US)' },
    { value: 'westus2', label: 'westus2 (West US 2)' },
    { value: 'westus3', label: 'westus3 (West US 3)' },
    { value: 'canadacentral', label: 'canadacentral (Canada Central)' },
    { value: 'brazilsouth', label: 'brazilsouth (Brazil South)' },
    { value: 'northeurope', label: 'northeurope (North Europe)' },
    { value: 'westeurope', label: 'westeurope (West Europe)' },
    { value: 'francecentral', label: 'francecentral (France Central)' },
    { value: 'germanywestcentral', label: 'germanywestcentral (Germany West Central)' },
    { value: 'norwayeast', label: 'norwayeast (Norway East)' },
    { value: 'swedencentral', label: 'swedencentral (Sweden Central)' },
    { value: 'switzerlandnorth', label: 'switzerlandnorth (Switzerland North)' },
    { value: 'uksouth', label: 'uksouth (UK South)' },
    { value: 'ukwest', label: 'ukwest (UK West)' },
    { value: 'uaenorth', label: 'uaenorth (UAE North)' },
    { value: 'southafricanorth', label: 'southafricanorth (South Africa North)' },
    { value: 'centralindia', label: 'centralindia (Central India)' },
    { value: 'eastasia', label: 'eastasia (East Asia)' },
    { value: 'southeastasia', label: 'southeastasia (Southeast Asia)' },
    { value: 'japaneast', label: 'japaneast (Japan East)' },
    { value: 'koreacentral', label: 'koreacentral (Korea Central)' },
    { value: 'australiaeast', label: 'australiaeast (Australia East)' },
];

/** The credential forms and their fields (keep in sync with admin `credentialTypes.ts`). */
const CREDENTIAL_FORMS: Record<CredentialForm, CredentialFieldDefinition[]> = {
    login: [
        { name: 'login', type: 'text', required: true, label: 'Login' },
        { name: 'password', type: 'password', encrypted: true, required: true, label: 'Password' },
    ],
    key: [{ name: 'key', type: 'password', encrypted: true, required: true, label: 'Key' }],
    aws: [
        { name: 'accessKeyId', type: 'text', required: true, label: 'Access Key ID' },
        { name: 'secretAccessKey', type: 'password', encrypted: true, required: true, label: 'Secret Access Key' },
        { name: 'region', type: 'select', required: true, label: 'Region', options: AWS_REGIONS },
    ],
    azure: [
        { name: 'subscriptionKey', type: 'password', encrypted: true, required: true, label: 'Subscription Key' },
        { name: 'region', type: 'select', required: true, label: 'Region', options: AZURE_REGIONS },
    ],
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
    aws: 'M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335a.383.383 0 0 1-.208.072c-.08 0-.16-.04-.239-.112a2.47 2.47 0 0 1-.287-.375 6.18 6.18 0 0 1-.248-.471c-.622.734-1.405 1.101-2.347 1.101-.67 0-1.205-.191-1.596-.574-.391-.384-.59-.894-.59-1.533 0-.678.239-1.23.726-1.644.487-.415 1.133-.623 1.955-.623.272 0 .551.024.846.064.296.04.6.104.918.176v-.583c0-.607-.127-1.03-.375-1.277-.255-.248-.686-.367-1.3-.367-.28 0-.568.031-.863.103-.295.072-.583.16-.862.272a2.287 2.287 0 0 1-.28.104.488.488 0 0 1-.127.023c-.112 0-.168-.08-.168-.247v-.391c0-.128.016-.224.056-.28a.597.597 0 0 1 .224-.167c.279-.144.614-.264 1.005-.36a4.84 4.84 0 0 1 1.246-.151c.95 0 1.644.216 2.091.647.439.43.662 1.085.662 1.963v2.586zm-3.24 1.214c.263 0 .534-.048.822-.144.287-.096.543-.271.758-.51.128-.152.224-.32.272-.512.047-.191.08-.423.08-.694v-.335a6.66 6.66 0 0 0-.735-.136 6.02 6.02 0 0 0-.75-.048c-.535 0-.926.104-1.19.32-.263.215-.39.518-.39.917 0 .375.095.655.295.846.191.2.47.296.838.296zm6.41.862c-.144 0-.24-.024-.304-.08-.064-.048-.12-.16-.168-.311L7.586 5.55a1.398 1.398 0 0 1-.072-.32c0-.128.064-.2.191-.2h.783c.151 0 .255.025.31.08.065.048.113.16.16.312l1.342 5.284 1.245-5.284c.04-.16.088-.264.151-.312a.549.549 0 0 1 .32-.08h.638c.152 0 .256.025.32.08.063.048.12.16.151.312l1.261 5.348 1.381-5.348c.048-.16.104-.264.16-.312a.52.52 0 0 1 .311-.08h.743c.127 0 .2.065.2.2 0 .04-.009.08-.017.128a1.137 1.137 0 0 1-.056.2l-1.923 6.17c-.048.16-.104.263-.168.311a.51.51 0 0 1-.303.08h-.687c-.151 0-.255-.024-.32-.08-.063-.056-.119-.16-.15-.32l-1.238-5.148-1.23 5.14c-.04.16-.087.264-.15.32-.065.056-.177.08-.32.08zm10.256.215c-.415 0-.83-.048-1.229-.143-.399-.096-.71-.2-.918-.32-.128-.071-.215-.151-.247-.223a.563.563 0 0 1-.048-.224v-.407c0-.167.064-.247.183-.247.048 0 .096.008.144.024.048.016.12.048.2.08.271.12.566.215.878.279.319.064.63.096.95.096.502 0 .894-.088 1.165-.264a.86.86 0 0 0 .415-.758.777.777 0 0 0-.215-.559c-.144-.151-.416-.287-.807-.415l-1.157-.36c-.583-.183-1.014-.454-1.277-.813a1.902 1.902 0 0 1-.4-1.158c0-.335.073-.63.216-.886.144-.255.335-.479.575-.654.24-.184.51-.32.83-.415.32-.096.655-.136 1.006-.136.175 0 .359.008.535.032.183.024.35.056.518.088.16.04.312.08.455.127.144.048.256.096.336.144a.69.69 0 0 1 .24.2.43.43 0 0 1 .071.263v.375c0 .168-.064.256-.184.256a.83.83 0 0 1-.303-.096 3.652 3.652 0 0 0-1.532-.311c-.455 0-.815.071-1.062.223-.248.152-.375.383-.375.71 0 .224.08.416.24.567.159.152.454.304.877.44l1.134.358c.574.184.99.44 1.237.767.247.327.367.702.367 1.117 0 .343-.072.655-.207.926-.144.272-.336.511-.583.703-.248.2-.543.343-.886.447-.36.111-.734.167-1.142.167zM21.698 16.207c-2.626 1.94-6.442 2.969-9.722 2.969-4.598 0-8.74-1.7-11.87-4.526-.247-.223-.024-.527.272-.351 3.384 1.963 7.559 3.153 11.877 3.153 2.914 0 6.114-.607 9.06-1.852.439-.2.814.287.383.607zM22.792 14.961c-.336-.43-2.22-.207-3.074-.103-.255.032-.295-.192-.063-.36 1.5-1.053 3.967-.75 4.254-.399.287.36-.08 2.826-1.485 4.007-.215.184-.423.088-.327-.151.32-.79 1.03-2.57.695-2.994z',
    azure: 'M22.379 23.343a1.62 1.62 0 0 0 1.536-2.14v.002L17.35 1.76A1.62 1.62 0 0 0 15.816.657H8.184A1.62 1.62 0 0 0 6.65 1.76L.086 21.204a1.62 1.62 0 0 0 1.536 2.139h4.741a1.62 1.62 0 0 0 1.535-1.103l.977-2.892 4.947 3.675c.28.208.618.32.966.32m-3.084-12.531 3.624 10.739a.54.54 0 0 1-.51.713v-.001h-.03a.54.54 0 0 1-.322-.106l-9.287-6.9h4.853m6.313 7.006c.116-.326.13-.694.007-1.058L9.79 1.76a1.722 1.722 0 0 0-.007-.02h6.034a.54.54 0 0 1 .512.366l6.562 19.445a.54.54 0 0 1-.338.684',
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
    aws: svgDataUrl(ICON_PATHS.aws, '#ff9900'),
    azure: svgDataUrl(ICON_PATHS.azure, '#0089d6'),
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
    aws: { label: 'AWS', icon: ICON_DATA.aws, form: 'aws', type: 'aws', name: 'aws' },
    azure: { label: 'Azure', icon: ICON_DATA.azure, form: 'azure', type: 'azure', name: 'azure' },
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
            this.setState({ addError: I18n.t('jc_A unique name is required') });
            return;
        }
        const id = `${CREDENTIALS_PREFIX}${name}`;
        if ((this.state.selectOptions || []).find(option => option.value === id)) {
            this.setState({ addError: I18n.t('jc_A credential with this name already exists') });
            return;
        }

        const form = template?.form || 'login';
        const fields = CREDENTIAL_FORMS[form];
        const addFields = this.state.addFields || {};
        if (fields.some(field => field.required && !(addFields[field.name] || '').trim())) {
            this.setState({ addError: I18n.t('jc_Please fill in all required fields') });
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
                form,
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
                addError: I18n.t('jc_Cannot create credential: %s', (e as Error).toString()),
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
                <DialogTitle>{I18n.t('jc_Add credential')}</DialogTitle>
                <DialogContent style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
                    <FormControl
                        fullWidth
                        variant="standard"
                    >
                        <InputLabel shrink>{I18n.t('jc_Template')}</InputLabel>
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
                            <InputLabel shrink>{I18n.t('jc_Credential type')}</InputLabel>
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
                        label={I18n.t('jc_Name')}
                        value={this.state.addName || ''}
                        error={!!this.state.addError}
                        helperText={this.state.addName ? id : ''}
                        slotProps={{ inputLabel: { shrink: true }, htmlInput: { autoComplete: 'off' } }}
                        onChange={e => this.setState({ addName: e.target.value, addError: '' })}
                    />

                    {fields.map(field => {
                        const fieldValue = this.state.addFields?.[field.name] || '';
                        if (field.type === 'select') {
                            const options = field.options ? [...field.options] : [];
                            // keep a preset value that is not part of the predefined list selectable
                            if (fieldValue && !options.find(option => option.value === fieldValue)) {
                                options.unshift({ value: fieldValue });
                            }
                            return (
                                <TextField
                                    key={field.name}
                                    select
                                    variant="standard"
                                    fullWidth
                                    required={field.required}
                                    label={I18n.t(field.label)}
                                    value={fieldValue}
                                    slotProps={{ inputLabel: { shrink: true } }}
                                    onChange={e =>
                                        this.setState({
                                            addFields: {
                                                ...(this.state.addFields || {}),
                                                [field.name]: e.target.value,
                                            },
                                            addError: '',
                                        })
                                    }
                                >
                                    {options.map(option => (
                                        <MenuItem
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label || option.value}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            );
                        }
                        return (
                            <TextField
                                key={field.name}
                                variant="standard"
                                fullWidth
                                type={field.type === 'password' ? 'password' : 'text'}
                                required={field.required}
                                label={I18n.t(field.label)}
                                value={fieldValue}
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
                        );
                    })}

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
                        {I18n.t('jc_Create')}
                    </Button>
                    <Button
                        variant="contained"
                        color="grey"
                        disabled={!!this.state.addSaving}
                        startIcon={<CloseIcon />}
                        onClick={() => this.setState({ addOpen: false })}
                    >
                        {I18n.t('jc_Cancel')}
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
                        title={I18n.t('jc_Add credential')}
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
