import React, { type JSX } from 'react';
import JSON5 from 'json5';

import { FormHelperText, FormControl, Button } from '@mui/material';

import { FormatAlignLeft as FormatIcon } from '@mui/icons-material';

import { I18n } from '@iobroker/gui-components';
import type { ConfigItemJsonEditor } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
import CustomModal from './wrapper/Components/CustomModal';
import Editor from './wrapper/Components/Editor';

const styles: Record<string, React.CSSProperties> = {
    fullWidth: {
        width: '100%',
    },
    flex: {
        display: 'flex',
    },
    button: {
        height: 48,
        // marginLeft: 4,
        minWidth: 48,
    },
    wrapper: {
        width: 'calc(100vw - 40px)',
        height: 'calc(100vh - 188px)',
    },
};

interface ConfigJsonEditorProps extends ConfigGenericProps {
    schema: ConfigItemJsonEditor;
}

interface ConfigJsonEditorState extends ConfigGenericState {
    initialized?: boolean;
    showSelectId?: boolean;
    jsonError?: boolean;
}

export default class ConfigJsonEditor extends ConfigGeneric<ConfigJsonEditorProps, ConfigJsonEditorState> {
    async componentDidMount(): Promise<void> {
        await super.componentDidMount();
        const { data, attr } = this.props;
        const value: string = ConfigGeneric.getValue(data, attr) || '{}';
        this.setState({ value, initialized: true, jsonError: this.validateJson(value) });
    }

    validateJson(value: string | null | undefined): boolean {
        let jsonError = false;
        if (this.props.schema.validateJson !== false) {
            if (value || !this.props.schema.allowEmpty) {
                try {
                    if (this.props.schema.json5) {
                        JSON5.parse(value as string);
                    } else {
                        JSON.parse(value as string);
                    }
                } catch (err: unknown) {
                    console.log('Error in JSON', err);
                    jsonError = true;
                }
            }
        }

        return jsonError;
    }

    /** Text shown in the editor. Objects (e.g. older settings) are shown indented, not in one line. */
    static toText(value: unknown): string {
        return typeof value === 'object' && value !== null ? JSON.stringify(value, null, 2) : (value as string);
    }

    /** Re-indents the current text with 2 spaces. Only possible if the text is valid JSON / JSON5. */
    formatJson(): void {
        const text = ConfigJsonEditor.toText(this.state.value);
        try {
            const value = this.props.schema.json5
                ? JSON5.stringify(JSON5.parse(text), null, 2)
                : JSON.stringify(JSON.parse(text), null, 2);
            this.setState({ value, jsonError: false });
        } catch (err: unknown) {
            console.log('Cannot format JSON', err);
            this.setState({ jsonError: true });
        }
    }

    renderItem(_error: string, disabled: boolean /* , defaultValue */): JSX.Element | null {
        if (!this.state.initialized) {
            return null;
        }

        const { schema, data, attr } = this.props;
        const { value, showSelectId } = this.state;
        const isReadOnly = schema.readOnly === true || disabled;

        return (
            <FormControl
                fullWidth
                variant="standard"
            >
                <div style={styles.flex}>
                    <Button
                        color="grey"
                        style={styles.button}
                        size="small"
                        variant="outlined"
                        onClick={() => this.setState({ showSelectId: true })}
                    >
                        {I18n.t('jc_JSON editor')}
                    </Button>
                </div>
                {showSelectId ? (
                    <CustomModal
                        title={this.getText(schema.label)}
                        overflowHidden
                        applyDisabled={(this.state.jsonError && this.props.schema.doNotApplyWithError) || isReadOnly}
                        onClose={() => {
                            if (isReadOnly) {
                                this.setState({ showSelectId: false });
                            } else {
                                this.setState({ showSelectId: false, value: ConfigGeneric.getValue(data, attr) || {} });
                            }
                        }}
                        onApply={
                            isReadOnly
                                ? undefined
                                : () => this.setState({ showSelectId: false }, () => attr && this.onChange(attr, value))
                        }
                        actions={
                            isReadOnly ? null : (
                                <Button
                                    color="grey"
                                    variant="outlined"
                                    startIcon={<FormatIcon />}
                                    disabled={!!this.state.jsonError}
                                    onClick={() => this.formatJson()}
                                >
                                    {I18n.t('jc_Format JSON')}
                                </Button>
                            )
                        }
                    >
                        <div
                            style={{
                                ...styles.wrapper,
                                border: this.state.jsonError ? '2px solid red' : '2px solid transparent',
                            }}
                        >
                            <Editor
                                mode={this.props.schema.json5 ? 'json5' : 'json'}
                                value={ConfigJsonEditor.toText(value)}
                                onChange={
                                    isReadOnly
                                        ? undefined
                                        : newValue =>
                                              this.setState({
                                                  value: newValue,
                                                  jsonError: this.validateJson(newValue),
                                              })
                                }
                                name="ConfigJsonEditor"
                                themeType={this.props.oContext.themeType}
                                AceEditor={this.props.oContext.AceEditor}
                            />
                        </div>
                    </CustomModal>
                ) : null}
                {schema.help || this.state.jsonError ? (
                    <FormHelperText>
                        {this.state.jsonError
                            ? I18n.t('jc_Invalid JSON')
                            : this.renderHelp(
                                  this.props.schema.help,
                                  this.props.schema.helpLink,
                                  this.props.schema.noTranslation,
                              )}
                    </FormHelperText>
                ) : null}
            </FormControl>
        );
    }
}
