import React, { type JSX } from 'react';

import { TextField } from '@mui/material';

/**
 * What the code editor of the host has to accept.
 *
 * Described here and not imported from `react-ace`, so that neither this library nor anything that
 * bundles it needs that package - not even for the types. `AceEditor` fulfils it as it is.
 */
export interface AceEditorProps {
    style?: React.CSSProperties;
    /** `object` because ace also takes a mode instance, this library only passes names */
    mode?: string | object;
    theme?: string;
    width?: string;
    height?: string;
    name?: string;
    value?: string;
    defaultValue?: string;
    /** ace also takes a CSS size like `12pt`, this library only passes numbers */
    fontSize?: number | string;
    readOnly?: boolean;
    showPrintMargin?: boolean;
    showGutter?: boolean;
    highlightActiveLine?: boolean;
    onChange?: (newValue: string) => void;
    setOptions?: Record<string, any>;
    editorProps?: Record<string, any>;
}

/**
 * The code editor of the host, in practice `AceEditor` from `react-ace`.
 *
 * It is handed in and not imported, because `react-ace` brings the whole `ace-builds` with it -
 * thousands of files and several megabytes. Everything that bundles this library would carry them
 * along, every custom component of every adapter included, although only three of the sixty config
 * items ever show an editor. The admin has the editor anyway, so it hands it in.
 *
 * The host registers what the editor is used with here: the modes `json`, `json5` and `yaml`, and
 * the themes `clouds_midnight` and `chrome`. Without an editor the fields fall back to a plain text
 * area, so nothing becomes unreadable or unwritable.
 */
export type AceEditorComponent = React.ComponentType<AceEditorProps>;

const styles: Record<string, React.CSSProperties> = {
    jsonError: {
        border: '1px solid red',
        minHeight: 200,
    },
    jsonNoError: {
        border: '1px solid #00000000',
        minHeight: 200,
    },
    fallback: {
        width: '100%',
        height: '100%',
    },
};

interface EditorProps {
    fontSize?: number;
    value?: string;
    defaultValue?: string;
    mode?: 'json' | 'css' | 'html' | 'json5' | 'yaml';
    name: string;
    onChange?: (newValue: string) => void;
    themeType: string;
    editValueMode?: boolean; // flag that indicates the "value edit mode"
    error?: boolean;
    /** Editor of the host. Without it the text area below is used. */
    AceEditor?: AceEditorComponent;
}

export default function Editor(props: EditorProps): JSX.Element {
    const style = props.error === true ? styles.jsonError : props.error === false ? styles.jsonNoError : undefined;

    if (!props.AceEditor) {
        // no editor from the host: a text area is not comfortable, but nothing is lost with it
        return (
            <TextField
                variant="outlined"
                style={{ ...styles.fallback, ...style }}
                slotProps={{
                    htmlInput: {
                        style: { fontFamily: 'monospace', fontSize: props.fontSize || 14 },
                        spellCheck: false,
                    },
                }}
                multiline
                fullWidth
                error={props.error === true}
                value={props.value ?? props.defaultValue ?? ''}
                onChange={e => props.onChange?.(e.target.value)}
                disabled={!props.onChange}
                name={props.name}
            />
        );
    }

    const AceEditor = props.AceEditor;

    return (
        <AceEditor
            style={style}
            mode={props.mode || 'json'}
            width="100%"
            height="100%"
            showPrintMargin={props.editValueMode}
            showGutter={props.editValueMode}
            highlightActiveLine={props.editValueMode}
            defaultValue={props.defaultValue}
            theme={props.themeType === 'dark' ? 'clouds_midnight' : 'chrome'}
            value={props.value}
            readOnly={!props.onChange}
            onChange={newValue => props.onChange?.(newValue)}
            name={props.name || 'UNIQUE_ID_OF_DIV1'}
            fontSize={props.fontSize || 14}
            setOptions={{
                enableBasicAutocompletion: true,
                enableLiveAutocompletion: true,
                enableSnippets: true,

                showLineNumbers: props.editValueMode,
                tabSize: props.editValueMode ? 2 : undefined,
            }}
            editorProps={{ $blockScrolling: true }}
        />
    );
}
