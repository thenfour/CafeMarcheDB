import React from "react";
import { Checkbox, FormControlLabel, MenuItem, Stack, TextField } from "@mui/material";
import { useLocale } from "src/locale/components/useLocale";
import { usePresentation } from "src/locale/components/PresentationProvider";
import type { DB3AuthSpec } from "../shared/db3core";
import type { LocalizedPlainStringKey } from "src/locale/shared/staticLocalizedStringRegistry";
import { type LocalizedFieldValue, isLocalizedFieldValue, emptyLocalizedFieldValue, LocalizedStringField } from "../shared/columnTypes/localizedString";
import { type InheritedFieldValue, isInheritedFieldValue, InheritedField } from "../shared/columnTypes/inherited";
import { IColumnClient, type IColumnClientArgs, type RenderForNewItemDialogArgs, type RenderViewerArgs } from "./DB3ClientCore";

export interface LocalizedFieldEditorProps {
    readonly value: LocalizedFieldValue;
    readonly localeTag: string;
    readonly label: string;
    readonly inheritLabel: string;
    readonly multiline?: boolean;
    readonly onChange: (value: LocalizedFieldValue) => void;
}

/** Editing another locale starts empty; displayed fallback text is never silently copied into it. */
export function LocalizedFieldEditor(props: LocalizedFieldEditorProps) {
    const { value, localeTag, onChange } = props;
    const inherit = value.edit?.kind === "inherit";
    const text = value.edit?.kind === "set" && value.edit.localeTag === localeTag ? value.edit.value
        : value.resolution?.localeTag === localeTag ? value.value ?? "" : "";
    return <Stack spacing={1}>
        <TextField label={props.label} value={text} multiline={props.multiline} disabled={inherit || !localeTag}
            onChange={event => onChange({ ...value, edit: { kind: "set", stringPublicId: value.stringPublicId, localeTag, value: event.target.value } })} />
        {value.canInherit && value.stringPublicId && <FormControlLabel label={props.inheritLabel}
            control={<Checkbox checked={inherit} onChange={(_event, checked) => onChange({ ...value,
                edit: checked && value.stringPublicId ? { kind: "inherit", stringPublicId: value.stringPublicId } : undefined })} />} />}
    </Stack>;
}

function NativeLocalizedEditor({ field, value, labelKey, onChange }: {
    readonly field: LocalizedStringField<DB3AuthSpec>;
    readonly value: LocalizedFieldValue;
    readonly labelKey: LocalizedPlainStringKey;
    readonly onChange: (value: LocalizedFieldValue) => void;
}) {
    const locale = useLocale();
    const presentation = usePresentation();
    const enabled = presentation.data?.localization.availability.band ?? [];
    const [localeTag, setLocaleTag] = React.useState(() => value.edit?.kind === "set" ? value.edit.localeTag
        : value.resolution?.localeTag && enabled.includes(value.resolution.localeTag) ? value.resolution.localeTag : enabled[0] ?? "");
    React.useEffect(() => {
        // A new form shows its chosen writing language. Saving its blank input is an explicit blank translation.
        if (value.resolution === null && !value.edit && enabled.includes(localeTag)) {
            onChange({ ...value, edit: { kind: "set", stringPublicId: value.stringPublicId, localeTag, value: "" } });
        }
    }, [value, localeTag, enabled, onChange]);
    return <Stack spacing={1}>
        <TextField select label={locale.getPlainString("catalog.locale")} value={localeTag} onChange={event => {
            setLocaleTag(event.target.value);
            onChange({ ...value, edit: undefined });
        }}>
            {!enabled.includes(localeTag) && <MenuItem value={localeTag} disabled>{localeTag}</MenuItem>}
            {enabled.map(tag => <MenuItem key={tag} value={tag}>{tag}</MenuItem>)}
        </TextField>
        <LocalizedFieldEditor value={value} localeTag={enabled.includes(localeTag) ? localeTag : ""}
            label={locale.getPlainString(labelKey)} inheritLabel={locale.getPlainString("catalog.inherit")}
            multiline={field.stringFormat === "Markdown"} onChange={onChange} />
    </Stack>;
}

export class LocalizedStringColumnClient<TColumnName extends string = string> extends IColumnClient<TColumnName, LocalizedFieldValue> {
    ApplyClientToPostClient = undefined;
    private field: LocalizedStringField<DB3AuthSpec>;
    constructor(args: Pick<IColumnClientArgs<TColumnName>, "columnName" | "fieldCaptionKey">) {
        super({ ...args, headerNameKey: args.fieldCaptionKey, fieldDescriptionKey: null, editable: true,
            visible: true, width: 240, isAutoFocusable: false, className: undefined });
    }
    onSchemaConnected = () => {
        if (!(this.schemaColumn instanceof LocalizedStringField)) {
            throw new Error("LocalizedStringColumnClient requires a LocalizedStringField.");
        }
        this.field = this.schemaColumn;
        this.GridColProps = {
            renderCell: params => this.display(params.value),
            renderEditCell: params => <NativeLocalizedEditor field={this.field}
                value={this.requireValue(params.value)} labelKey={this.fieldCaptionKey}
                onChange={value => { void params.api.setEditCellValue({ id: params.id, field: this.columnName, value }); }} />,
        };
    };
    private requireValue(value: unknown): LocalizedFieldValue {
        if (value === undefined) {
            return emptyLocalizedFieldValue();
        }
        if (!isLocalizedFieldValue(value)) {
            throw new Error(`Field '${this.columnName}' has no localized client value.`);
        }
        return value;
    }
    private display(value: unknown) {
        const field = this.requireValue(value);
        return <span lang={field.resolution?.localeTag ?? undefined}>{field.value}</span>;
    }
    renderViewer = (params: RenderViewerArgs<unknown>) => this.defaultRenderer({
        value: this.display(params.value), isReadOnly: true, validationResult: undefined,
    });
    renderForNewDialog = (params: RenderForNewItemDialogArgs) => <NativeLocalizedEditor
        field={this.field} value={this.requireValue(params.value)} labelKey={this.fieldCaptionKey}
        onChange={value => params.api.setFieldValues({ [this.columnName]: value })} />;
}

function InheritControl({ inherited, onChange }: { readonly inherited: boolean; readonly onChange: (checked: boolean) => void }) {
    const locale = useLocale();
    return <FormControlLabel label={locale.getPlainString("catalog.inherit")}
        control={<Checkbox checked={inherited} onChange={(_event, checked) => onChange(checked)} />} />;
}

/** Wrap an existing scalar DB3 renderer; its controls, conversion, and validation stay authoritative. */
export class InheritedColumnClient<TColumnName extends string, TValue> extends IColumnClient<TColumnName, InheritedFieldValue<TValue | null>> {
    ApplyClientToPostClient = undefined;
    constructor(readonly valueColumn: IColumnClient<TColumnName, TValue>, args: { readonly fieldCaptionKey: LocalizedPlainStringKey }) {
        super({ columnName: valueColumn.columnName, width: valueColumn.width, editable: valueColumn.editable,
            visible: valueColumn.visible, isAutoFocusable: valueColumn.isAutoFocusable, className: valueColumn.className,
            fieldCaptionKey: args.fieldCaptionKey, headerNameKey: args.fieldCaptionKey, fieldDescriptionKey: null });
    }
    onSchemaConnected = (tableClient: Parameters<IColumnClient["onSchemaConnected"]>[0]) => {
        if (!(this.schemaColumn instanceof InheritedField)) {
            throw new Error("InheritedColumnClient requires an InheritedField.");
        }
        this.valueColumn.schemaTable = this.schemaTable;
        this.valueColumn.schemaColumn = this.schemaColumn.valueField;
        this.valueColumn.headerName = this.headerName;
        this.valueColumn.fieldCaption = this.fieldCaption;
        this.valueColumn.fieldCaptionKey = this.fieldCaptionKey;
        this.valueColumn.fieldDescriptionKey = this.fieldDescriptionKey;
        this.valueColumn.onSchemaConnected(tableClient);
        const scalarGrid = this.valueColumn.GridColProps;
        this.GridColProps = {
            ...scalarGrid,
            renderCell: params => scalarGrid?.renderCell ? scalarGrid.renderCell({ ...params, value: this.requireValue(params.value).value })
                : <span>{String(this.requireValue(params.value).value ?? "")}</span>,
            renderEditCell: params => this.renderForNewDialog({ key: params.id, row: params.row, value: params.value, autoFocus: false,
                api: { setFieldValues: values => { void params.api.setEditCellValue({ id: params.id, field: this.columnName, value: values[this.columnName] }); } } }),
        };
    };
    private requireValue(value: unknown): InheritedFieldValue<unknown> {
        if (!isInheritedFieldValue(value)) {
            throw new Error(`Field '${this.columnName}' has no inherited client value.`);
        }
        return value;
    }
    renderViewer = (params: RenderViewerArgs<unknown>) => this.valueColumn.renderViewer({ ...params, value: this.requireValue(params.value).value });
    renderForNewDialog = (params: RenderForNewItemDialogArgs) => {
        const value = this.requireValue(params.value);
        const scalarRenderer = this.valueColumn.renderForNewDialog;
        if (!scalarRenderer) {
            throw new Error(`Field '${this.columnName}' has no editor.`);
        }
        return <Stack spacing={1}>
            {scalarRenderer({ ...params, row: { ...params.row, [this.columnName]: value.value }, value: value.value,
                api: { setFieldValues: values => {
                    const next = values[this.columnName];
                    params.api.setFieldValues({ [this.columnName]: { ...value, value: next, override: next } });
                } } })}
            <InheritControl inherited={value.override === null} onChange={checked => params.api.setFieldValues({
                [this.columnName]: { ...value, value: checked ? value.inheritedValue : value.value, override: checked ? null : value.value },
            })} />
        </Stack>;
    };
}
