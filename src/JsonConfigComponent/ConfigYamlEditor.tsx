import React, { type JSX } from 'react';
import { parse } from 'yaml';

import { FormHelperText, FormControl, Button } from '@mui/material';

import { I18n } from '@iobroker/adapter-react-v5';
import type { ConfigItemYamlEditor } from '../types';
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
        minWidth: 48,
    },
    wrapper: {
        width: 'calc(100vw - 40px)',
        height: 'calc(100vh - 188px)',
    },
};

interface ConfigYamlEditorProps extends ConfigGenericProps {
    schema: ConfigItemYamlEditor;
}

interface ConfigYamlEditorState extends ConfigGenericState {
    initialized?: boolean;
    showSelectId?: boolean;
    yamlError?: boolean;
}

export default class ConfigYamlEditor extends ConfigGeneric<ConfigYamlEditorProps, ConfigYamlEditorState> {
    componentDidMount(): void {
        super.componentDidMount();
        const { data, attr } = this.props;
        const value: string = ConfigGeneric.getValue(data, attr) || '';
        this.setState({ value, initialized: true, yamlError: this.validateYaml(value) });
    }

    validateYaml(value: string | null | undefined): boolean {
        let yamlError = false;
        if (this.props.schema.validateYaml !== false) {
            if (value || !this.props.schema.allowEmpty) {
                try {
                    parse(value);
                } catch (err: unknown) {
                    console.log('Error in YAML', err);
                    yamlError = true;
                }
            }
        }

        return yamlError;
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
                        {I18n.t('ra_YAML editor')}
                    </Button>
                </div>
                {showSelectId ? (
                    <CustomModal
                        title={this.getText(schema.label)}
                        overflowHidden
                        applyDisabled={(this.state.yamlError && this.props.schema.doNotApplyWithError) || isReadOnly}
                        onClose={() => {
                            if (isReadOnly) {
                                this.setState({ showSelectId: false });
                            } else {
                                this.setState({ showSelectId: false, value: ConfigGeneric.getValue(data, attr) || '' });
                            }
                        }}
                        onApply={
                            isReadOnly
                                ? undefined
                                : () => this.setState({ showSelectId: false }, () => this.onChange(attr, value))
                        }
                    >
                        <div
                            style={{
                                ...styles.wrapper,
                                border: this.state.yamlError ? '2px solid red' : '2px solid transparent',
                            }}
                        >
                            <Editor
                                mode="yaml"
                                value={typeof value === 'object' ? JSON.stringify(value) : value}
                                onChange={
                                    isReadOnly
                                        ? undefined
                                        : newValue =>
                                              this.setState({
                                                  value: newValue,
                                                  yamlError: this.validateYaml(newValue),
                                              })
                                }
                                name="ConfigYamlEditor"
                                themeType={this.props.oContext.themeType}
                            />
                        </div>
                    </CustomModal>
                ) : null}
                {schema.help || this.state.yamlError ? (
                    <FormHelperText>
                        {this.state.yamlError
                            ? I18n.t('ra_Invalid YAML')
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
