/**
 * Compatibility gate for custom components loaded via module federation.
 *
 * The admin shares React, MUI and the ioBroker component libraries as federation singletons, so
 * there is exactly one version of each at runtime. A component built against an older generation
 * would be handed APIs it was never compiled against and usually dies while rendering. This module
 * decides *before* the remote is registered whether it may run at all.
 */

/**
 * Generation of the GUI API this build of `@iobroker/json-config` provides.
 *
 * Generation `2` is `@iobroker/gui-components` (React 19 / MUI 9); generation `1` was the legacy
 * `@iobroker/adapter-react-v5` (React 18 / MUI 6).
 *
 * Bump this only when a change actually breaks components built against the previous generation.
 */
export const GUI_API_GENERATION = 2;

/** Component library of the current generation */
const CURRENT_LIBRARY = '@iobroker/gui-components';
/** Component library of generation 1 */
const LEGACY_LIBRARY = '@iobroker/adapter-react-v5';

/** How long to wait for the manifest before falling back to the declared generation */
const MANIFEST_TIMEOUT_MS = 5_000;

export interface GuiApiVerdict {
    /** Whether the component may be loaded */
    compatible: boolean;
    /** Generation the component was built against, as far as it could be determined */
    declared: number;
    /** True if the component needs a *newer* admin, false if it is too old for this one */
    tooNew: boolean;
}

interface FederationManifest {
    shared?: { name?: string; version?: string }[];
}

/** Manifests are fetched once per remote and reused, keyed by the manifest URL */
const manifestCache = new Map<string, Promise<FederationManifest | null>>();

/**
 * Fetch the module federation manifest that sits next to the remote entry.
 *
 * This is a best-effort lookup: components built before manifests were shipped simply do not have
 * one, which is not an error - the caller then falls back to the declared generation.
 */
async function loadManifest(entryUrl: string): Promise<FederationManifest | null> {
    const slash = entryUrl.lastIndexOf('/');
    const manifestUrl = `${slash === -1 ? entryUrl : entryUrl.substring(0, slash)}/mf-manifest.json`;

    let promise = manifestCache.get(manifestUrl);
    if (!promise) {
        promise = (async (): Promise<FederationManifest | null> => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), MANIFEST_TIMEOUT_MS);
            try {
                const response = await fetch(manifestUrl, { signal: controller.signal });
                if (!response.ok) {
                    return null;
                }
                return (await response.json()) as FederationManifest;
            } catch {
                // No manifest, unreachable or unparsable - treated as "unknown", not as an error
                return null;
            } finally {
                clearTimeout(timer);
            }
        })();
        manifestCache.set(manifestUrl, promise);
    }
    return promise;
}

/** Which component library the remote was built against, or null if the manifest does not say */
function libraryFromManifest(manifest: FederationManifest | null): string | null {
    const shared = manifest?.shared;
    if (!Array.isArray(shared)) {
        return null;
    }
    if (shared.some(entry => entry?.name === LEGACY_LIBRARY)) {
        return LEGACY_LIBRARY;
    }
    if (shared.some(entry => entry?.name === CURRENT_LIBRARY)) {
        return CURRENT_LIBRARY;
    }
    return null;
}

/**
 * Decide whether a custom component may be loaded.
 *
 * Precedence:
 * 1. The manifest is authoritative when it names the legacy library - that component cannot run.
 * 2. An explicit `guiApi` in the schema is compared against the generation provided here.
 * 3. A manifest naming the current library counts as compatible.
 * 4. Otherwise the component predates this marker and is treated as generation 1.
 *
 * Note that a manifest can only rule a component *out* by its library name; ruling it *in* means
 * "at least generation 2". Should a generation 3 ever exist, the `guiApi` attribute (step 2) is
 * what distinguishes it, which is why the explicit declaration wins over step 3.
 *
 * @param entryUrl absolute URL of the remote entry, like `https://host/adapter/x/custom/customComponents.js`
 * @param declared value of the `guiApi` attribute from the jsonConfig schema, if the component sets it
 */
export async function checkGuiApiCompatibility(entryUrl: string, declared?: number): Promise<GuiApiVerdict> {
    const library = libraryFromManifest(await loadManifest(entryUrl));

    if (library === LEGACY_LIBRARY) {
        return { compatible: false, declared: 1, tooNew: false };
    }

    if (typeof declared === 'number' && Number.isFinite(declared)) {
        return {
            compatible: declared === GUI_API_GENERATION,
            declared,
            tooNew: declared > GUI_API_GENERATION,
        };
    }

    if (library === CURRENT_LIBRARY) {
        return { compatible: true, declared: GUI_API_GENERATION, tooNew: false };
    }

    return { compatible: false, declared: 1, tooNew: false };
}
