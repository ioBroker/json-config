/**
 * The code editor for the `jsonEditor`, `yamlEditor` and `sendTo` items.
 *
 * The library does not bring `react-ace` any more: it would pull the whole `ace-builds` into every
 * bundle that uses the library, and only three of the sixty config items ever show an editor. So the
 * host provides it - here this test GUI, in production the ioBroker admin - together with the modes
 * and themes the library asks for.
 */
import AceEditor from 'react-ace';

import 'ace-builds/src-min-noconflict/mode-json';
import 'ace-builds/src-min-noconflict/mode-json5';
import 'ace-builds/src-min-noconflict/mode-yaml';
// The `worker-*` files are web worker scripts: they bail out immediately when loaded in a window
// (`if (typeof e.window != 'undefined' && e.document) return;`), so importing them here would do
// nothing. As ES modules `this` is `undefined` instead of the global, which made them throw
// "Cannot read properties of undefined (reading 'window')" and blocked the whole app from starting.
// Ace loads its workers over `ace.config.setModuleUrl()` when they are actually wanted.
import 'ace-builds/src-min-noconflict/theme-clouds_midnight';
import 'ace-builds/src-min-noconflict/theme-chrome';
import 'ace-builds/src-min-noconflict/ext-language_tools';

export default AceEditor;
