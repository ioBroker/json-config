import type { Plugin, UserConfig } from 'vite';

/** The worker scripts of ace, which the JSON/YAML editors pull in via `react-ace`. */
const ACE_WORKERS = ['ace-builds/src-min-noconflict/worker-json'];

/**
 * `worker-json` is a worker script, not a module. Its top-level IIFE is invoked as `}(this)` and relies on
 * `this === window` when loaded via a `<script>` tag - then its own guard (`if (e.window && e.document) return`)
 * makes it a no-op in the main thread. Vite turns it into ESM, where top-level `this` is `undefined`, so it throws
 * `Cannot read properties of undefined (reading 'window')` before React ever renders. Handing it `globalThis` lets
 * the guard do its job. `react-ace` loads the real worker in a separate worker context, so nothing is lost.
 */
function fixAceWorker(): Plugin {
    return {
        name: 'fix-ace-worker',
        enforce: 'pre',
        transform(code: string, id: string): string | null {
            if (!id.includes('ace-builds') || !id.includes('worker-')) {
                return null;
            }
            return code.replace(/\}\(this\)(?=\s*,\s*ace\.define)/g, '}(globalThis)');
        },
    };
}

export default {
    plugins: [fixAceWorker()],
    build: {
        outDir: 'build',
        sourcemap: true,
        rollupOptions: {
            onwarn: (warning: any, warn: (log: any) => void) => {
                if (
                    warning.code === 'MODULE_LEVEL_DIRECTIVE' ||
                    warning.code === 'SOURCEMAP_ERROR' ||
                    // the `fix-ace-worker` plugin below rewrites a minified one-liner and emits no sourcemap
                    warning.code === 'SOURCEMAP_BROKEN'
                ) {
                    return;
                }
                warn(warning);
            },
        },
    },
    base: './',
    optimizeDeps: {
        // Keep `ace-builds` itself pre-bundled - `react-ace` requires it as CJS - but serve the worker scripts raw,
        // so that the plugin above can patch them.
        exclude: ACE_WORKERS,
    },
    server: {
        port: 3000,
    },
} satisfies UserConfig;
