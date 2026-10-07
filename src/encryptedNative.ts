/**
 * Resolving the attribute paths of `encryptedNative`
 *
 * An entry of `encryptedNative` names an attribute of `native`, and it may reach into it:
 * `hosts.password` means the password of every row of the `hosts` table. The attribute used to be
 * looked up in `native` as it is, which hits `password` but misses `hosts.password`, so the secrets
 * of a table were neither decrypted when the configuration was loaded nor encrypted when it was
 * saved and ended up in the instance object as plain text.
 */

/** Prefix that `encrypt` puts in front of an AES-192-CBC value */
export const AES_192_CBC_PREFIX = '$/aes-192-cbc:';

/**
 * Returns the value to store instead of the one that was reached
 *
 * @param value - the non-empty string the path reached
 * @param isNested - whether the path reaches into `native` instead of naming a top level attribute
 */
export type ReplaceEncryptedValue = (value: string, isNested: boolean) => string;

/**
 * Walk an attribute path and replace every value it reaches
 *
 * Where the path meets an array, it is followed through each of its entries, so one path can reach
 * the same attribute of every row of a table. What the path does not reach, and anything that is
 * not a non-empty string, is left alone.
 *
 * @param obj - the object to walk, `native` of the instance object or a part of it
 * @param attrParts - the remaining segments of the attribute path
 * @param replace - returns the new value for a reached string
 * @param isNested - whether the path reaches into `native` instead of naming a top level attribute
 */
function replaceAtPath(
    obj: Record<string, any>,
    attrParts: string[],
    replace: ReplaceEncryptedValue,
    isNested: boolean,
): void {
    const [part, ...rest] = attrParts;

    if (!rest.length) {
        if (typeof obj[part] === 'string' && obj[part]) {
            obj[part] = replace(obj[part], isNested);
        }
        return;
    }

    const next = obj[part];
    if (!next || typeof next !== 'object') {
        return;
    }

    if (Array.isArray(next)) {
        for (const entry of next) {
            if (entry && typeof entry === 'object') {
                replaceAtPath(entry, rest, replace, isNested);
            }
        }
        return;
    }

    replaceAtPath(next, rest, replace, isNested);
}

/**
 * Replace every value that an entry of `encryptedNative` addresses
 *
 * @param native - `native` of the instance object, changed in place
 * @param encryptedNative - the attribute paths listed in the instance object
 * @param replace - returns the new value for a reached string, told whether the path is a nested one
 */
export function replaceEncryptedNative(
    native: Record<string, any> | undefined,
    encryptedNative: string[] | undefined,
    replace: ReplaceEncryptedValue,
): void {
    if (!native || !Array.isArray(encryptedNative)) {
        return;
    }

    for (const attr of encryptedNative) {
        if (typeof attr === 'string' && attr) {
            const attrParts = attr.split('.');
            replaceAtPath(native, attrParts, replace, attrParts.length > 1);
        }
    }
}
