import React, { type JSX } from 'react';

import { Button, Dialog, DialogActions, DialogContent, Tooltip } from '@mui/material';

import { I18n, Icon } from '@iobroker/adapter-react-v5';

import type { ConfigItemStaticImage } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';

interface ConfigStaticImageProps extends ConfigGenericProps {
    schema: ConfigItemStaticImage;
}

interface ConfigStaticImageState extends ConfigGenericState {
    showDialog?: boolean;
}

class ConfigStaticImage extends ConfigGeneric<ConfigStaticImageProps, ConfigStaticImageState> {
    private getSrc(): string {
        let src = this.props.schema.src;
        if (
            src &&
            !src.startsWith('.') &&
            !src.startsWith('http') &&
            !src.startsWith(`adapter/${this.props.oContext.adapterName}/`) &&
            !src.startsWith(`./adapter/${this.props.oContext.adapterName}/`)
        ) {
            src = `${this.props.oContext.imagePrefix}/adapter/${this.props.oContext.adapterName}/${src}`;
        }
        return src;
    }

    renderItem(/* error: string, disabled: boolean, defaultValue */): JSX.Element {
        const { schema } = this.props;
        const src = this.getSrc();

        if (schema.showInDialog) {
            const smallSize = schema.showInDialogSmallSize || 100;
            const buttonLabel = schema.showInDialogButtonLabel ? this.getText(schema.showInDialogButtonLabel) : '';

            return (
                <>
                    <Tooltip title={I18n.t('ra_Click to see in full size')}>
                        <img
                            src={src}
                            style={{
                                cursor: 'pointer',
                                width: 'auto',
                                height: smallSize,
                                objectFit: 'contain',
                            }}
                            alt=""
                            onClick={() => this.setState({ showDialog: true })}
                        />
                    </Tooltip>{' '}
                    {buttonLabel ? (
                        <Button
                            variant="outlined"
                            color="grey"
                            onClick={() => this.setState({ showDialog: true })}
                        >
                            {buttonLabel}
                        </Button>
                    ) : null}
                    {this.state.showDialog ? (
                        <Dialog
                            open={!0}
                            onClose={() => this.setState({ showDialog: false })}
                            maxWidth="lg"
                        >
                            <DialogContent>
                                <Icon
                                    src={src}
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                />
                            </DialogContent>
                            <DialogActions>
                                <Button
                                    variant="contained"
                                    onClick={() => this.setState({ showDialog: false })}
                                    color="primary"
                                >
                                    {I18n.t('ra_Close')}
                                </Button>
                            </DialogActions>
                        </Dialog>
                    ) : null}
                </>
            );
        }

        return (
            <img
                src={src}
                style={{ cursor: schema.href ? 'pointer' : undefined, width: '100%', height: '100%' }}
                onClick={schema.href ? () => schema.href && window.open(schema.href, '_blank') : null}
                alt=""
            />
        );
    }
}

export default ConfigStaticImage;
