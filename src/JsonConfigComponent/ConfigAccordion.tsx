import React, { type JSX } from 'react';

import {
    FormHelperText,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    IconButton,
    Paper,
    Toolbar,
    Tooltip,
    Typography,
    Box,
} from '@mui/material';

import {
    Add as AddIcon,
    Delete as DeleteIcon,
    ArrowUpward as UpIcon,
    ArrowDownward as DownIcon,
    ContentCopy as CopyContentIcon,
    ExpandMore as ExpandMoreIcon,
    Error as ErrorIcon,
    FileDownload as FileDownloadIcon,
    FileUpload as FileUploadIcon,
    AddCircle as AddCircleIcon,
} from '@mui/icons-material';

import { I18n, type IobTheme, Utils } from '@iobroker/gui-components';

import type { ConfigItemAccordion, ConfigItemAny, ConfigItemIndexed, ConfigItemPanel } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';

import ConfigPanel from './ConfigPanel';

const styles: Record<string, any> = {
    fullWidth: {
        width: '100%',
    },
    accordionSummary: (theme: IobTheme): React.CSSProperties => ({
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    }),
    accordionTitle: {
        // fontWeight: 'bold',
    },
    toolbar: (theme: IobTheme): React.CSSProperties => ({
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
        borderRadius: '3px',
    }),
    tooltip: {
        pointerEvents: 'none',
    },
};

interface ConfigAccordionProps extends ConfigGenericProps {
    schema: ConfigItemAccordion;
}

interface ConfigAccordionState extends ConfigGenericState {
    value: Record<string, any>[];
    activeIndex: number;
    iteration: number;
    accordionErrors: Record<number, Record<string, string>>; // accordion index -> attr -> error
}

class ConfigAccordion extends ConfigGeneric<ConfigAccordionProps, ConfigAccordionState> {
    private typingTimer: ReturnType<typeof setTimeout> | null = null;

    /** Error state last reported to the parent, so the same state is not reported twice */
    private reportedAccordionError: string = '';

    constructor(props: ConfigAccordionProps) {
        super(props);
        this.props.schema.items ||= [];
    }

    async componentDidMount(): Promise<void> {
        await super.componentDidMount();

        let value = ConfigGeneric.getValue(this.props.data, this.props.attr) || [];

        if (!Array.isArray(value)) {
            value = [];
        }

        this.setState({
            value,
            activeIndex: -1,
            iteration: 0,
            accordionErrors: {},
        });
    }

    componentWillUnmount(): void {
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
            this.typingTimer = null;
        }
        super.componentWillUnmount();
    }

    /**
     * Report the error state of the whole accordion to the parent.
     * The error registry of the parent is a flat map of attribute names, so all entries would write into
     * the same slot and would clear each other's errors. Therefore, only one aggregated error is
     * reported, and it is stored under the attribute of the accordion itself.
     *
     * @param accordionErrors errors of the entries, indexed by the entry position
     */
    reportAccordionError(accordionErrors: Record<number, Record<string, string>>): void {
        const entryWithError = Object.keys(accordionErrors).find(
            index => Object.keys(accordionErrors[parseInt(index, 10)]).length > 0,
        );
        const error = entryWithError === undefined ? '' : I18n.t('jc_Some entries are invalid');

        if (error !== this.reportedAccordionError) {
            this.reportedAccordionError = error;
            this.onError(this.props.attr, error || undefined);
        }
    }

    /**
     * Move the errors together with their entries, so an error marker stays on the entry it belongs to
     *
     * @param accordionErrors errors of the entries, indexed by the entry position
     * @param mapIndex returns the new position of an entry or null if the entry does not exist anymore
     */
    static remapAccordionErrors(
        accordionErrors: Record<number, Record<string, string>>,
        mapIndex: (index: number) => number | null,
    ): Record<number, Record<string, string>> {
        const result: Record<number, Record<string, string>> = {};
        for (const indexStr of Object.keys(accordionErrors)) {
            const index = parseInt(indexStr, 10);
            const newIndex = mapIndex(index);
            if (newIndex !== null) {
                result[newIndex] = accordionErrors[index];
            }
        }
        return result;
    }

    onAccordionError =
        (accordionIndex: number) =>
        (attr?: string, error?: string): void => {
            // Without an attribute, the error cannot be assigned to an item, and an empty record would
            // mark the entry as faulty forever
            if (!attr) {
                return;
            }

            this.setState(
                prevState => {
                    // The state must be copied inside the updater: all entries of one render pass report
                    // their errors in the same batch, and a copy taken outside would be the same
                    // outdated state for every one of them, so only the last report would survive
                    const accordionErrors = { ...prevState.accordionErrors };
                    const entryErrors = { ...accordionErrors[accordionIndex] };

                    if (error) {
                        entryErrors[attr] = error;
                    } else {
                        delete entryErrors[attr];
                    }

                    if (Object.keys(entryErrors).length) {
                        accordionErrors[accordionIndex] = entryErrors;
                    } else {
                        delete accordionErrors[accordionIndex];
                    }

                    return { accordionErrors };
                },
                () => this.reportAccordionError(this.state.accordionErrors),
            );
        };

    hasAccordionErrors = (accordionIndex: number): boolean => {
        return Object.keys(this.state.accordionErrors[accordionIndex] || {}).length > 0;
    };

    itemAccordion(data: Record<string, any>, idx: number): JSX.Element {
        const { value } = this.state;
        const { schema } = this.props;

        const schemaItem: ConfigItemPanel = {
            type: 'panel',
            items: schema.items.reduce(
                (accumulator: Record<string, ConfigItemIndexed>, currentValue: ConfigItemIndexed) => {
                    if (currentValue.attr) {
                        accumulator[currentValue.attr] = currentValue;
                    }
                    return accumulator;
                },
                {},
            ) as Record<string, ConfigItemAny>,
            style: { marginLeft: '-8px', marginTop: '10px', marginBottom: '10px' },
        };

        return (
            <ConfigPanel
                oContext={this.props.oContext}
                index={idx + this.state.iteration}
                arrayIndex={idx}
                changed={this.props.changed}
                expertMode={this.props.expertMode}
                globalData={this.props.data}
                common={this.props.common}
                alive={this.props.alive}
                themeName={this.props.themeName}
                data={data}
                custom
                schema={schemaItem}
                originalData={this.props.originalData}
                onChange={(attr: string | Record<string, any> | undefined, valueChange?: any): void => {
                    if (typeof attr === 'string' && attr) {
                        const newObj: Record<string, any> = JSON.parse(JSON.stringify(value));
                        newObj[idx][attr] = valueChange;
                        this.setState({ value: newObj } as ConfigAccordionState, () => this.onChangeWrapper(newObj));
                    }
                }}
                onError={this.onAccordionError(idx)}
                onHiddenChanged={this.props.onHiddenChanged}
                table={this.props.table}
                customComponents={this.props.customComponents}
            />
        );
    }

    onDelete = (index: number) => (): void => {
        const newValue = JSON.parse(JSON.stringify(this.state.value));
        newValue.splice(index, 1);

        // drop the errors of the deleted entry and shift the errors of all entries below it
        const accordionErrors = ConfigAccordion.remapAccordionErrors(this.state.accordionErrors, entryIndex =>
            entryIndex === index ? null : entryIndex > index ? entryIndex - 1 : entryIndex,
        );

        this.setState({ value: newValue, iteration: this.state.iteration + 10000, accordionErrors }, () => {
            this.reportAccordionError(this.state.accordionErrors);
            this.onChangeWrapper(newValue);
        });
    };

    onClone = (index: number) => (): void => {
        const newValue = JSON.parse(JSON.stringify(this.state.value)) as Record<string, any>[];
        const cloned = JSON.parse(JSON.stringify(newValue[index]));
        if (typeof this.props.schema.clone === 'string' && typeof cloned[this.props.schema.clone] === 'string') {
            let i = 1;
            let text = cloned[this.props.schema.clone];
            const pattern = text.match(/(\d+)$/);
            if (pattern) {
                text = text.replace(pattern[0], '');
                i = parseInt(pattern[0], 10) + 1;
            } else {
                text += '_';
            }
            while (newValue.find(it => it[this.props.schema.clone as string] === text + i.toString())) {
                i++;
            }
            cloned[this.props.schema.clone] = `${cloned[this.props.schema.clone]}_${i}`;
        }

        newValue.splice(index, 0, cloned);

        this.setState(
            {
                value: newValue,
                activeIndex: -1,
                iteration: this.state.iteration + 10000,
                // the clone takes the position `index`, so the errors from there on move one entry down
                accordionErrors: ConfigAccordion.remapAccordionErrors(this.state.accordionErrors, entryIndex =>
                    entryIndex >= index ? entryIndex + 1 : entryIndex,
                ),
            },
            () => this.onChangeWrapper(newValue),
        );
    };

    onChangeWrapper = (newValue: any): void => {
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
        }

        this.typingTimer = setTimeout(
            value => {
                this.typingTimer = null;
                if (this.props.attr) {
                    const mayByPromise = this.onChange(this.props.attr, value);
                    if (mayByPromise instanceof Promise) {
                        void mayByPromise.catch(e => this.onError(e));
                    }
                }
            },
            300,
            newValue,
        );
    };

    onAdd = async (): Promise<void> => {
        const { schema } = this.props;
        const newValue = JSON.parse(JSON.stringify(this.state.value));
        const newItem: Record<string, any> = {};

        if (schema.items) {
            for (const currentValue of schema.items) {
                let defaultValue;
                if (currentValue.defaultFunc) {
                    if (this.props.custom) {
                        defaultValue = currentValue.defaultFunc
                            ? await this.executeCustom(
                                  currentValue.defaultFunc,
                                  this.props.data,
                                  this.props.customObj,
                                  this.props.oContext.instanceObj,
                                  newValue.length,
                                  this.props.data,
                              )
                            : this.props.schema.default;
                    } else {
                        defaultValue = currentValue.defaultFunc
                            ? await this.execute(
                                  currentValue.defaultFunc,
                                  this.props.schema.default,
                                  this.props.data,
                                  newValue.length,
                                  this.props.data,
                              )
                            : this.props.schema.default;
                    }
                } else {
                    defaultValue = currentValue.default ?? null;
                }

                if (currentValue.attr) {
                    newItem[currentValue.attr] = defaultValue;
                }
            }
        }

        newValue.push(newItem);

        this.setState({ value: newValue, activeIndex: newValue.length - 1 }, () => this.onChangeWrapper(newValue));
    };

    onMoveUp(idx: number): void {
        const newValue = JSON.parse(JSON.stringify(this.state.value));
        const item = newValue[idx];
        newValue.splice(idx, 1);
        newValue.splice(idx - 1, 0, item);

        const newIndex = this.state.activeIndex - 1;
        this.setState(
            {
                value: newValue,
                activeIndex: newIndex,
                iteration: this.state.iteration + 10000,
                // the moved entry and its predecessor exchange their positions
                accordionErrors: ConfigAccordion.remapAccordionErrors(this.state.accordionErrors, entryIndex =>
                    entryIndex === idx ? idx - 1 : entryIndex === idx - 1 ? idx : entryIndex,
                ),
            },
            () => this.onChangeWrapper(newValue),
        );
    }

    onMoveDown(idx: number): void {
        const newValue = JSON.parse(JSON.stringify(this.state.value));
        const item = newValue[idx];
        newValue.splice(idx, 1);
        newValue.splice(idx + 1, 0, item);

        const newIndex = this.state.activeIndex + 1;
        this.setState(
            {
                value: newValue,
                activeIndex: newIndex,
                iteration: this.state.iteration + 10000,
                // the moved entry and its successor exchange their positions
                accordionErrors: ConfigAccordion.remapAccordionErrors(this.state.accordionErrors, entryIndex =>
                    entryIndex === idx ? idx + 1 : entryIndex === idx + 1 ? idx : entryIndex,
                ),
            },
            () => this.onChangeWrapper(newValue),
        );
    }

    onExport = (): void => {
        const { value } = this.state;
        const dataStr = JSON.stringify(value, null, 2);
        const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;

        const exportFileDefaultName = `config_section_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    onImport = (replace: boolean): void => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (event: Event) => {
            const file = (event.target as HTMLInputElement).files?.[0];
            if (!file) {
                return;
            }

            const reader = new FileReader();
            reader.onload = e => {
                try {
                    const jsonData = JSON.parse(e.target?.result as string);

                    if (!Array.isArray(jsonData)) {
                        alert(I18n.t('jc_Invalid JSON format. Expected an array.'));
                        return;
                    }

                    let newValue: Record<string, any>[];
                    if (replace) {
                        newValue = jsonData;
                    } else {
                        newValue = [...this.state.value, ...jsonData];
                    }

                    this.setState({ value: newValue, activeIndex: -1 }, () => this.onChangeWrapper(newValue));
                } catch {
                    alert(I18n.t('jc_Invalid JSON file.'));
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    renderItem(/* error, disabled, defaultValue */): JSX.Element | null {
        const { schema } = this.props;
        const { value } = this.state;

        if (!value) {
            return null;
        }

        return (
            <Paper>
                {schema.label || !schema.noDelete ? (
                    <Toolbar variant="dense">
                        {schema.label ? (
                            <Typography
                                variant="h6"
                                id="tableTitle"
                                component="div"
                            >
                                {this.getText(schema.label)}
                            </Typography>
                        ) : null}
                        {!schema.noDelete ? (
                            <>
                                <Tooltip title={I18n.t('jc_Export configuration section')}>
                                    <IconButton
                                        size="small"
                                        color="primary"
                                        onClick={this.onExport}
                                    >
                                        <FileDownloadIcon />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title={I18n.t('jc_Import and replace configuration section')}>
                                    <IconButton
                                        size="small"
                                        color="primary"
                                        onClick={() => this.onImport(true)}
                                    >
                                        <FileUploadIcon />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title={I18n.t('jc_Import and add configuration section')}>
                                    <IconButton
                                        size="small"
                                        color="primary"
                                        onClick={() => this.onImport(false)}
                                    >
                                        <AddCircleIcon />
                                    </IconButton>
                                </Tooltip>
                                <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={this.onAdd}
                                >
                                    <AddIcon />
                                </IconButton>
                            </>
                        ) : null}
                    </Toolbar>
                ) : null}
                {value.map((idx, i) => (
                    <Accordion
                        key={`${idx as unknown as string}_${i}`}
                        expanded={this.state.activeIndex === i}
                        onChange={(_e, expanded) => this.setState({ activeIndex: expanded ? i : -1 })}
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            sx={Utils.getStyle(this.props.oContext.theme, styles.fullWidth, styles.accordionSummary)}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                {schema.titleAttr && (
                                    <Typography style={styles.accordionTitle}>{idx[schema.titleAttr]}</Typography>
                                )}
                                {this.hasAccordionErrors(i) && <ErrorIcon sx={{ fontSize: 20, color: 'error.main' }} />}
                            </Box>
                        </AccordionSummary>
                        <AccordionDetails
                            style={{
                                ...schema.style,
                                ...(this.props.oContext.themeType ? schema.darkStyle : undefined),
                            }}
                        >
                            {this.itemAccordion(value[i], i)}
                            <Toolbar sx={styles.toolbar}>
                                {i ? (
                                    <Tooltip
                                        title={I18n.t('jc_Move up')}
                                        slotProps={{ popper: { sx: styles.tooltip } }}
                                    >
                                        <IconButton
                                            size="small"
                                            onClick={() => this.onMoveUp(i)}
                                        >
                                            <UpIcon />
                                        </IconButton>
                                    </Tooltip>
                                ) : (
                                    <div style={styles.buttonEmpty} />
                                )}
                                {i < value.length - 1 ? (
                                    <Tooltip
                                        title={I18n.t('jc_Move down')}
                                        slotProps={{ popper: { sx: styles.tooltip } }}
                                    >
                                        <IconButton
                                            size="small"
                                            onClick={() => this.onMoveDown(i)}
                                        >
                                            <DownIcon />
                                        </IconButton>
                                    </Tooltip>
                                ) : (
                                    <div style={styles.buttonEmpty} />
                                )}
                                {!schema.noDelete ? (
                                    <Tooltip
                                        title={I18n.t('jc_Delete current row')}
                                        slotProps={{ popper: { sx: styles.tooltip } }}
                                    >
                                        <IconButton
                                            size="small"
                                            onClick={this.onDelete(i)}
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    </Tooltip>
                                ) : null}
                                {schema.clone ? (
                                    <Tooltip
                                        title={I18n.t('jc_Clone current row')}
                                        slotProps={{ popper: { sx: styles.tooltip } }}
                                    >
                                        <IconButton
                                            size="small"
                                            onClick={this.onClone(i)}
                                        >
                                            <CopyContentIcon />
                                        </IconButton>
                                    </Tooltip>
                                ) : null}
                            </Toolbar>
                        </AccordionDetails>
                    </Accordion>
                ))}
                {!schema.noDelete && value.length > 0 ? (
                    <Toolbar
                        variant="dense"
                        sx={styles.rootTool}
                    >
                        <IconButton
                            size="small"
                            color="primary"
                            onClick={this.onAdd}
                        >
                            <AddIcon />
                        </IconButton>
                    </Toolbar>
                ) : null}
                {schema.help ? (
                    <FormHelperText>
                        {this.renderHelp(
                            this.props.schema.help,
                            this.props.schema.helpLink,
                            this.props.schema.noTranslation,
                        )}
                    </FormHelperText>
                ) : null}
            </Paper>
        );
    }
}

export default ConfigAccordion;
