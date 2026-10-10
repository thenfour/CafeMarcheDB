import { useMutation } from "@blitzjs/rpc";
import { Checkbox, FormControlLabel, MenuItem, TextField } from "@mui/material";
import React from "react";
import { z } from "zod";
import { CMButton, CMButtonGroup } from "src/core/components/CMCoreComponents2";
import { useSnackbar } from "src/core/components/SnackbarContext";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import updateBulkSettings from "../../server/mutations/updateBulkSettings";
import {
    getSettingDefinition, SettingCommandSchema, type SettingCommand, type SettingsHive,
    type SettingSnapshot, type SettingsHiveSnapshot,
} from "../../shared/settingsContract";
import {
    getSettingsEditorLabelKey, parseSettingsClipboard, serializeSettingsClipboard, settingsScopeLabelKeys,
} from "../../shared/settingsEditor";

/** A feature can add draft tools without making the settings editor own its workflow. */
export interface SettingDraftToolsProps {
    readonly hive: SettingsHive;
    readonly settingKey: string;
    readonly draft: string | boolean;
    readonly onChange: (value: string | boolean) => void;
    readonly readOnly: boolean;
    readonly saving: boolean;
    readonly onBusyChange: (busy: boolean) => void;
}
export type RenderSettingDraftTools = (props: SettingDraftToolsProps) => React.ReactNode;

interface SettingRowProps {
    readonly hive: SettingsHive;
    readonly settingKey: string;
    readonly entry: SettingSnapshot;
    readonly pending: boolean;
    readonly save: (commands: readonly SettingCommand[]) => Promise<void>;
    readonly renderDraftTools?: RenderSettingDraftTools;
}

function settingDraft(value: unknown): string | boolean {
    // All current registries use strings or booleans. New value types need an explicit editor.
    if (typeof value === "string" || typeof value === "boolean") {
        return value;
    }
    throw new Error("Unsupported settings editor value.");
}

function SettingRow({ hive, settingKey, entry, pending, save, renderDraftTools }: SettingRowProps) {
    const locale = useLocale();
    const snackbar = useSnackbar();
    const definition = getSettingDefinition(hive, settingKey);
    const [draft, setDraft] = React.useState(() => settingDraft(entry.value));
    const [toolsBusy, setToolsBusy] = React.useState(false);
    const previousValue = React.useRef(entry.value);
    React.useEffect(() => {
        // A refresh updates untouched fields without discarding a failed or unsaved edit.
        const previous = previousValue.current;
        previousValue.current = entry.value;
        setDraft(current => current === previous ? settingDraft(entry.value) : current);
    }, [entry.value]);
    const validation = definition.schema.safeParse(draft);
    const dirty = draft !== entry.value;
    const disabled = pending || toolsBusy || !entry.capabilities.canEdit;
    const label = locale.getPlainString(getSettingsEditorLabelKey(hive, settingKey));

    const write = async (operation: SettingCommand["operation"]) => {
        try {
            await save([{ hive, key: settingKey, operation }]);
            if (operation.kind === "reset") {
                setDraft(settingDraft(definition.defaultValue));
            } else {
                setDraft(settingDraft(operation.value));
            }
            snackbar.showSuccess(locale.getPlainString(operation.kind === "reset" ? "settings.resetDone" : "settings.saved"));
        } catch (error) {
            console.error(error);
            snackbar.showError(locale.getPlainString("settings.failed"));
        }
    };

    let input: React.ReactNode;
    if (typeof draft === "boolean") {
        input = <FormControlLabel label={label} control={<Checkbox checked={draft} disabled={disabled}
            onChange={event => setDraft(event.target.checked)} />} />;
    } else if (definition.schema instanceof z.ZodEnum) {
        input = <TextField select fullWidth label={label} value={draft} disabled={disabled}
            onChange={event => setDraft(event.target.value)}>
            {definition.schema.options.map((option: string) => {
                if (option !== "inline" && option !== "dialog") {
                    throw new Error(`No editor option label for ${hive}/${settingKey}/${option}.`);
                }
                return <MenuItem key={option} value={option}>{locale.getPlainString(`settings.option.${option}`)}</MenuItem>;
            })}
        </TextField>;
    } else {
        input = <TextField fullWidth label={label} value={draft} disabled={disabled}
            onChange={event => setDraft(event.target.value)} error={!validation.success}
            helperText={validation.success ? undefined : validation.error.issues[0]?.message} />;
    }
    return <div data-settings-key={settingKey} style={{ marginBottom: 20 }}>
        {input}
        {renderDraftTools?.({ hive, settingKey, draft, onChange: setDraft,
            readOnly: !entry.capabilities.canEdit, saving: pending, onBusyChange: setToolsBusy })}
        <div>{locale.getPlainString(entry.source === "stored" ? "settings.stored" : "settings.default")}</div>
        {entry.capabilities.canEdit && <CMButtonGroup>
            <CMButton disabled={disabled || !dirty || !validation.success} onClick={() => {
                if (validation.success) {
                    void write({ kind: "set", value: validation.data });
                }
            }}>{locale.getPlainString("settings.save")}</CMButton>
            <CMButton disabled={disabled || entry.source === "default"} onClick={() => { void write({ kind: "reset" }); }}>
                {locale.getPlainString("settings.reset")}
            </CMButton>
            <CMButton disabled={pending || toolsBusy || !dirty} onClick={() => setDraft(settingDraft(entry.value))}>
                {locale.getPlainString("common.action.cancel")}
            </CMButton>
        </CMButtonGroup>}
    </div>;
}

function SettingsScopeEditor({ hive, snapshot, renderDraftTools }: {
    readonly hive: SettingsHive; readonly snapshot: SettingsHiveSnapshot;
    readonly renderDraftTools?: RenderSettingDraftTools;
}) {
    const presentation = usePresentation();
    const locale = useLocale();
    const snackbar = useSnackbar();
    const [mutate] = useMutation(updateBulkSettings);
    const [pending, setPending] = React.useState(false);
    // The ref closes the gap before React renders the disabled controls.
    const writing = React.useRef(false);
    const active = React.useRef(true);
    React.useEffect(() => {
        active.current = true;
        return () => { active.current = false; };
    }, []);
    const visible = Object.entries(snapshot).filter(([, entry]) => entry.capabilities.canView);
    const canImport = visible.some(([, entry]) => entry.capabilities.canEdit);

    const save = async (commands: readonly SettingCommand[]) => {
        if (!active.current) {
            throw new Error("The settings scope changed before the write began.");
        }
        if (writing.current) {
            throw new Error("A settings write is already in progress.");
        }
        writing.current = true;
        setPending(true);
        try {
            await mutate({ commands: [...commands], bandPublicId: presentation.bandPublicId });
            await presentation.invalidate();
        } finally {
            writing.current = false;
            setPending(false);
        }
    };

    const clipboard = async (operation: "copy" | "paste") => {
        try {
            if (operation === "copy") {
                await navigator.clipboard.writeText(serializeSettingsClipboard(snapshot));
                snackbar.showSuccess(locale.getPlainString("settings.copied"));
            } else {
                const text = await navigator.clipboard.readText();
                if (!active.current) {
                    return;
                }
                await save(parseSettingsClipboard(hive, snapshot, text));
                snackbar.showSuccess(locale.getPlainString("settings.imported"));
            }
        } catch (error) {
            console.error(error);
            snackbar.showError(locale.getPlainString("settings.clipboardFailed"));
        }
    };

    if (visible.length === 0) {
        return <p>{locale.getPlainString("settings.empty")}</p>;
    }
    return <>
        <CMButtonGroup>
            <CMButton disabled={pending} onClick={() => { void clipboard("copy"); }}>{locale.getPlainString("settings.copy")}</CMButton>
            {canImport && <CMButton disabled={pending} onClick={() => { void clipboard("paste"); }}>
                {locale.getPlainString("settings.paste")}
            </CMButton>}
        </CMButtonGroup>
        {visible.map(([key, entry]) => <SettingRow key={key} hive={hive} settingKey={key} entry={entry}
            pending={pending} save={save} renderDraftTools={renderDraftTools} />)}
    </>;
}

/** A fixed hive is used by branding; the settings page allows explicit scope selection. */
export function RegisteredSettingsEditor({ hive: fixedHive, renderDraftTools }: {
    readonly hive?: SettingsHive; readonly renderDraftTools?: RenderSettingDraftTools;
}) {
    const presentation = usePresentation();
    const locale = useLocale();
    const [selectedHive, setSelectedHive] = React.useState<SettingsHive>("global");
    const hive = fixedHive ?? selectedHive;
    if (!presentation.data) {
        return <div aria-busy="true" />;
    }
    const identity = presentation.data.authorization;
    const scopeKey = JSON.stringify([hive, identity.userPublicId, identity.bandPublicId, identity.bandUserPublicId]);
    return <>
        {!fixedHive && <TextField select fullWidth label={locale.getPlainString("settings.scope")} value={hive}
            onChange={event => setSelectedHive(SettingCommandSchema.shape.hive.parse(event.target.value))}>
            {Object.entries(settingsScopeLabelKeys).map(([value, labelKey]) => <MenuItem key={value} value={value}>
                {locale.getPlainString(labelKey)}
            </MenuItem>)}
        </TextField>}
        <SettingsScopeEditor key={scopeKey} hive={hive} snapshot={presentation.data.settings[hive]} renderDraftTools={renderDraftTools} />
    </>;
}
