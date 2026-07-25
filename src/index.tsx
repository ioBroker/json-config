import JsonConfig from './JsonConfig';
import JsonConfigComponent from './JsonConfigComponent';
import ConfigPanel from './JsonConfigComponent/ConfigPanel';
import ConfigGeneric from './JsonConfigComponent/ConfigGeneric';

export type {
    DeviceManagerPropsProps,
    ConfigGenericProps,
    ConfigGenericState,
} from './JsonConfigComponent/ConfigGeneric';

export type {
    ConfigItemType,
    ConfigItemConfirmData,
    ConfigItem,
    ConfigItemAlive,
    ConfigItemSelectOption,
    ConfigItemPanel,
    ConfigItemPattern,
    ConfigItemChip,
    ConfigItemComponent,
    ConfigItemTabs,
    ConfigItemText,
    ConfigItemColor,
    ConfigItemCheckbox,
    ConfigItemNumber,
    ConfigItemQrCode,
    ConfigItemQrCodeSendTo,
    ConfigItemPassword,
    ConfigItemObjectId,
    ConfigItemSlider,
    ConfigItemTopic,
    ConfigItemIP,
    ConfigItemUser,
    ConfigItemStaticDivider,
    ConfigItemStaticHeader,
    ConfigItemStaticImage,
    ConfigItemStaticText,
    ConfigItemRoom,
    ConfigItemFunc,
    ConfigItemSelect,
    ConfigItemAutocomplete,
    ConfigItemSetState,
    ConfigItemAutocompleteSendTo,
    ConfigItemAccordion,
    ConfigItemDivider,
    ConfigItemHeader,
    ConfigItemCoordinates,
    ConfigItemCustom,
    ConfigItemDatePicker,
    ConfigItemDeviceManager,
    ConfigItemLanguage,
    ConfigItemPort,
    ConfigItemImageSendTo,
    ConfigItemSendTo,
    ConfigItemState,
    ConfigItemTextSendTo,
    ConfigItemSelectSendTo,
    ConfigItemTable,
    ConfigItemTimePicker,
    ConfigItemCertCollection,
    ConfigItemCRON,
    ConfigItemCertificateSelect,
    ConfigItemCredentialSelect,
    ConfigItemLicense,
    ConfigItemCertificates,
    ConfigItemCheckLicense,
    ConfigItemUUID,
    ConfigItemJsonEditor,
    ConfigItemYamlEditor,
    ConfigItemInterface,
    ConfigItemImageUpload,
    ConfigItemInstanceSelect,
    ConfigItemFile,
    ConfigItemFileSelector,
    ConfigItemAny,
    BackEndCommandType,
    BackEndCommandGeneric,
    BackEndCommandNoOperation,
    BackEndCommandRefresh,
    BackEndCommandOpenLink,
    BackEndCommandMessage,
    BackEndCommand,
} from './types';

/**
 * Generation of the GUI API this build of `@iobroker/json-config` provides.
 *
 * A custom component declares the generation it was built against via `guiApi` in its jsonConfig
 * schema. Generation `2` is `@iobroker/gui-components` (React 19 / MUI 9); everything below was
 * built against the legacy `@iobroker/adapter-react-v5` (React 18 / MUI 6) and cannot run here,
 * because the shared React/MUI singletons it expects are no longer provided.
 *
 * Bump this only when a change actually breaks components built against the previous generation.
 */
export const GUI_API_GENERATION = 2;

export { JsonConfig, JsonConfigComponent, ConfigPanel, ConfigGeneric };
