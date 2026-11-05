import React, { type JSX } from 'react';

import { InputLabel, FormHelperText, FormControl } from '@mui/material';

import { UploadImage } from '@iobroker/gui-components';

import type { ConfigItemImageUpload } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';

interface ConfigImageUploadProps extends ConfigGenericProps {
    schema: ConfigItemImageUpload;
}

interface ConfigImageUploadState extends ConfigGenericState {
    image?: string;
    oContext?: string;
    /** The image is being written into the file */
    uploading?: boolean;
    /** Writing the image failed: `UploadImage` shows a cross instead of the check mark */
    uploadError?: boolean;
}

class ConfigImageUpload extends ConfigGeneric<ConfigImageUploadProps, ConfigImageUploadState> {
    private index: number;

    constructor(props: ConfigImageUploadProps) {
        super(props);
        this.index = Date.now();
    }

    async componentDidMount(): Promise<void> {
        await super.componentDidMount();

        if (this.props.schema.base64) {
            const value = ConfigGeneric.getValue(this.props.data, this.props.attr);
            this.setState({ value });
        } else if (this.props.attr) {
            void this.props.oContext.socket
                .fileExists(`${this.props.oContext.adapterName}.${this.props.oContext.instance}`, this.props.attr)
                .then(exist => exist && this.loadImage());
        }
    }

    _getUrl(update?: boolean): string {
        if (update) {
            this.index = Date.now();
        }
        let url = `files/${this.props.oContext.adapterName}.${this.props.oContext.instance}/${this.props.attr}?t=${this.index}`;
        if (window.location.port === '3000') {
            url = `${window.location.protocol}//${window.location.hostname}:8081/${url}`;
        }

        return url;
    }

    loadImage(): void {
        void fetch(this._getUrl())
            .then(res => res.blob())
            .then(blob => {
                const reader = new FileReader();
                reader.onload = () => {
                    this.setState({ value: reader.result });
                };
                reader.readAsDataURL(blob);
            })
            .catch(e => console.error(e));
    }

    /**
     * Writes the image into the file `attr` of the instance. `UploadImage` shows the upload in the corner of the image
     * and then a check mark or a cross: `uploadError` must change together with `uploading`.
     */
    uploadImage(fileName: string, base64: string): void {
        if (base64.startsWith('data')) {
            base64 = base64.split(',')[1];
        }
        this.setState({ uploading: true, uploadError: false });
        this.props.oContext.socket
            .writeFile64(`${this.props.oContext.adapterName}.${this.props.oContext.instance}`, fileName, base64)
            .then(() => this.setState({ uploading: false, uploadError: false }))
            .catch(e => {
                console.error(e);
                this.setState({ uploading: false, uploadError: true });
            });
    }

    renderItem(error: string, disabled: boolean /* , defaultValue */): JSX.Element {
        return (
            <FormControl
                fullWidth
                variant="standard"
            >
                {this.props.schema.label ? (
                    <InputLabel shrink>{this.getText(this.props.schema.label)}</InputLabel>
                ) : null}
                <UploadImage
                    error={!!error}
                    disabled={disabled}
                    accept={this.props.schema.accept}
                    crop={this.props.schema.crop}
                    maxSize={this.props.schema.maxSize || 256 * 1024}
                    icon={this.state.value || undefined}
                    uploading={!!this.state.uploading}
                    uploadError={!!this.state.uploadError}
                    removeIconFunc={() =>
                        this.setState({ value: null }, () => {
                            if (this.props.attr) {
                                if (this.props.schema.base64) {
                                    const mayBePromise = this.onChange(this.props.attr, this.state.value);
                                    if (mayBePromise instanceof Promise) {
                                        void mayBePromise.catch(e => console.error(`Cannot set value: ${e}`));
                                    }
                                } else {
                                    // delete file to /instance/attr
                                    void this.props.oContext.socket
                                        .deleteFile(
                                            `${this.props.oContext.adapterName}.${this.props.oContext.instance}`,
                                            this.props.attr,
                                        )
                                        .catch(e => console.error(e));
                                }
                            }
                        })
                    }
                    onChange={base64 =>
                        this.setState({ value: base64 }, () => {
                            if (this.props.attr) {
                                if (this.props.schema.base64) {
                                    // the image is stored in the configuration, not in a file
                                    const mayBePromise = this.onChange(this.props.attr, this.state.value);
                                    if (mayBePromise instanceof Promise) {
                                        void mayBePromise.catch(e => console.error(`Cannot set value: ${e}`));
                                    }
                                } else {
                                    // upload file to /instance/attr
                                    this.uploadImage(this.props.attr, base64);
                                }
                            }
                        })
                    }
                />
                {this.props.schema.help || this.getValidatorErrorText() ? (
                    <FormHelperText>
                        {this.renderHelp(
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

export default ConfigImageUpload;
