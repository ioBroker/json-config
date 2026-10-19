/**
 * Whether the version of a license fits the installed version of the adapter
 *
 * A license carries a rule for the major version, like `<2`, `>=3` or just `2`. The check used to answer
 * `true` whatever the rule said, so a vis-1 license (`<2`) was reported as valid for vis-2, which the
 * adapter itself rejects.
 */

/**
 * Check the rule of a license against the installed version
 *
 * @param version - the installed version of the adapter, like `2.20.2`
 * @param rule - the version of the license, like `<2`; without a rule every version is valid
 * @param invoice - the invoice of the license, `free` or the number of the invoice
 * @param adapterName - the name of the adapter, like `vis-2`
 * @param convertedVis - a vis-1 license with a UUID: vis-2 accepts it for its version 2
 */
export function isLicenseVersionValid(
    version: string | undefined,
    rule: string | undefined,
    invoice: string | undefined,
    adapterName: string,
    convertedVis?: boolean,
): boolean {
    if (!rule || !version) {
        return true;
    }
    // the server sends the rule HTML-escaped sometimes
    rule = rule.replace(/^&lt;/, '<').replace(/^&gt;/, '>');
    const major = parseInt(version.split('.')[0], 10);
    let result = true;
    if (rule.startsWith('>=')) {
        result = major >= parseInt(rule.substring(2, 10), 10);
    } else if (rule.startsWith('<=')) {
        result = major <= parseInt(rule.substring(2, 10), 10);
    } else if (rule.startsWith('>')) {
        result = major > parseInt(rule.substring(1, 10), 10);
    } else if (rule.startsWith('<')) {
        result = major < parseInt(rule.substring(1, 10), 10);
    } else if (rule.startsWith('===')) {
        result = major === parseInt(rule.substring(3, 10), 10);
    } else if (rule.startsWith('==')) {
        result = major === parseInt(rule.substring(2, 10), 10);
    } else if (rule.startsWith('=')) {
        result = major === parseInt(rule.substring(1, 10), 10);
    } else if (/^\d+$/.test(rule)) {
        // a license for one major version, like "2"
        result = major === parseInt(rule, 10);
    }

    // the same exception as in the vis-2 adapter (checkLicense in its main.ts)
    if (!result && convertedVis && adapterName === 'vis-2' && major === 2) {
        return true;
    }

    // all commercial licenses are valid for all versions
    if (!result && invoice && invoice !== 'free' && adapterName) {
        return true;
    }

    return result;
}
