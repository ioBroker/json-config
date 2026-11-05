/**
 * What saving the configuration writes into the instance object
 *
 * The dialog shows the native as it was when the dialog was opened. The adapter may write into its own native while
 * the dialog is open - devices added by a device manager, a generated key - and saving used to write every attribute
 * of the dialog back, so such a value was set back to the state of the opening.
 */

/**
 * Put the attributes of the dialog into the native of the instance object as read when saving
 *
 * Only an attribute the dialog changed - its value differs from the one loaded when the dialog was opened - is
 * written; every other attribute keeps what the instance object holds now. An attribute that is not saved is
 * removed from the native and returned with its value in the dialog, so the dialog keeps it.
 *
 * @param native - the native of the instance object as read when saving, changed in place
 * @param data - the attributes of the dialog
 * @param originalData - the attributes as loaded when the dialog was opened
 * @param isSaved - whether an attribute is saved at all
 * @param setValue - writes one attribute into the native, `null` removes it
 * @returns the attributes that are not saved, with their values in the dialog
 */
export function writeDialogData(
    native: Record<string, any>,
    data: Record<string, any>,
    originalData: Record<string, any> | undefined,
    isSaved: (attr: string) => boolean,
    setValue: (native: Record<string, any>, attr: string, value: any) => void,
): Record<string, any> {
    const doNotSaveAttributes: Record<string, any> = {};

    for (const attr of Object.keys(data)) {
        if (!isSaved(attr)) {
            setValue(native, attr, null);
            doNotSaveAttributes[attr] = data[attr];
        } else if (JSON.stringify(data[attr]) !== JSON.stringify(originalData?.[attr])) {
            setValue(native, attr, data[attr]);
        }
    }

    return doNotSaveAttributes;
}
