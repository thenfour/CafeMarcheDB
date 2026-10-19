import { scopedAuthorizationSatisfiesRequirement } from "src/auth/shared/permissionRequirement";
import { invoke, useMutation } from "@blitzjs/rpc";
import { MenuItem, TextField } from "@mui/material";
import React from "react";
import { Permission } from "shared/permissions";
import { CMButton, CMButtonGroup } from "src/core/components/CMCoreComponents2";
import { Markdown } from "src/core/components/markdown/Markdown";
import { Markdown3Editor } from "src/core/components/markdown/MarkdownControl3";
import { useSnackbar } from "src/core/components/SnackbarContext";
import type { TClientUploadFileArgs } from "src/core/db3/shared/fileTypes";
import updateStaticString from "../mutations/updateStaticString";
import getStaticStringEditor from "../queries/getStaticStringEditor";
import { presentationContextKey } from "../shared/presentationContext";
import { type LocalizedMarkdownKey } from "../shared/staticLocalizedStringRegistry";
import {
    selectStaticStringEditLocale, staticStringWritePermission,
    type StaticStringEditorData,
    type StaticStringTarget, type StaticStringWrite
} from "../shared/staticStringEdit";
import { usePresentation } from "./PresentationProvider";
import { useLocale } from "./useLocale";

export type LocalizedMarkdownAttachmentPolicy = { readonly kind: "disabled" }
    | { readonly kind: "band"; readonly fields: Omit<TClientUploadFileArgs, "externalURI"> };

export interface LocalizedMarkdownProps {
    readonly id: LocalizedMarkdownKey;
    readonly scope: StaticStringTarget["scope"];
    readonly editLocale: string;
    readonly onEditLocaleChange: (localeTag: string) => void;
    readonly attachments: LocalizedMarkdownAttachmentPolicy;
    readonly fallbackMarkdown?: string | null;
    readonly fallbackWhen?: "null" | "emptyString" | "nullOrEmptyString";
}

interface EditorProps {
    readonly target: StaticStringTarget;
    readonly canEdit: boolean;
    readonly canSetLocale: boolean;
    readonly attachments: LocalizedMarkdownAttachmentPolicy;
    readonly onClose: () => void;
}

function LocalizedMarkdownEditor({ target, canEdit, canSetLocale, attachments, onClose }: EditorProps) {
    const locale = useLocale();
    const presentation = usePresentation();
    const snackbar = useSnackbar();
    const [mutate] = useMutation(updateStaticString);
    const [stored, setStored] = React.useState<StaticStringEditorData | null>(null);
    const [draft, setDraft] = React.useState("");
    const [inherit, setInherit] = React.useState(false);
    const [loadFailed, setLoadFailed] = React.useState(false);
    const [retry, setRetry] = React.useState(0);
    const [saving, setSaving] = React.useState(false);
    const [uploading, setUploading] = React.useState(false);
    const writing = React.useRef(false);
    const active = React.useRef(true);
    const initialized = React.useRef(false);
    const previousStored = React.useRef<string | null>(null);
    React.useEffect(() => {
        active.current = true;
        return () => { active.current = false; };
    }, []);
    // Refetch authority after permission changes without discarding an existing draft.
    const authorityKey = presentation.data?.authorization.effectivePermissionNames.join(",") ?? "";
    React.useEffect(() => {
        if (!canEdit) {
            return;
        }
        let current = true;
        setLoadFailed(false);
        void invoke(getStaticStringEditor, target).then(result => {
            if (!current) {
                return;
            }
            setStored(result);
            const firstLoad = !initialized.current;
            const previous = previousStored.current;
            setDraft(value => firstLoad || value === (previous ?? "") ? result.value ?? "" : value);
            previousStored.current = result.value;
            initialized.current = true;
        }).catch(() => {
            if (current) {
                setLoadFailed(true);
            }
        });
        return () => { current = false; };
    }, [target, canEdit, canSetLocale, authorityKey, retry]);

    const save = async (close: boolean) => {
        if (!canEdit || !stored || writing.current || uploading || !active.current || !inherit && (!stored.canSet || !canSetLocale)) {
            return;
        }
        writing.current = true;
        setSaving(true);
        const operation: StaticStringWrite["operation"] = inherit ? { kind: "reset" } : { kind: "set", value: draft };
        try {
            await mutate({ target, operation });
        } catch (error) {
            if (active.current) {
                console.error(error);
                snackbar.showError(locale.getPlainString("localizedMarkdown.failed"));
                setSaving(false);
            }
            writing.current = false;
            return;
        }
        if (!active.current) {
            return;
        }
        const value = operation.kind === "set" ? operation.value : null;
        setStored({ ...stored, value });
        previousStored.current = value;
        setDraft(value ?? "");
        setInherit(false);
        snackbar.showSuccess(locale.getPlainString("localizedMarkdown.saved"));
        try {
            await presentation.invalidate();
        } catch {
            if (active.current) {
                snackbar.showError(locale.getPlainString("localizedMarkdown.refreshFailed"));
            }
        } finally {
            writing.current = false;
            if (active.current) {
                setSaving(false);
                if (close) {
                    onClose();
                }
            }
        }
    };

    if (!stored) {
        return <>
            <div role={loadFailed ? "alert" : "status"}>{locale.getPlainString(!canEdit ? "localizedMarkdown.unavailable"
                : loadFailed ? "localizedMarkdown.loadFailed" : "localizedMarkdown.loading")}</div>
            {loadFailed && canEdit && <CMButton onClick={() => setRetry(value => value + 1)}>
                {locale.getPlainString("localizedMarkdown.retry")}</CMButton>}
            <CMButton onClick={onClose}>{locale.getPlainString("common.action.cancel")}</CMButton>
        </>;
    }
    const dirty = inherit ? stored.value !== null : draft !== stored.value;
    const canSave = canEdit && !saving && !uploading && dirty && (inherit || stored.canSet && canSetLocale);
    return <>
        <div>{locale.getPlainString(stored.value === null ? "localizedMarkdown.missing" : "localizedMarkdown.stored")}</div>
        {inherit && <div role="status">{locale.getPlainString("localizedMarkdown.resetNotice")}</div>}
        <Markdown3Editor value={draft} onChange={setDraft} nominalHeight={300} autoFocus
            readonly={!canEdit || saving || inherit || !stored.canSet || !canSetLocale} showActionButtons={false}
            onUploadBusyChange={setUploading}
            allowUploads={attachments.kind === "band" && target.scope === "band"}
            uploadFileContext={attachments.kind === "band" ? attachments.fields : undefined} />
        <CMButtonGroup>
            <CMButton disabled={!canSave} onClick={() => { void save(false); }}>{locale.getPlainString("localizedMarkdown.save")}</CMButton>
            <CMButton disabled={!canSave} onClick={() => { void save(true); }}>{locale.getPlainString("localizedMarkdown.saveAndClose")}</CMButton>
            <CMButton disabled={!canEdit || saving || uploading || stored.value === null} onClick={() => setInherit(value => !value)}>
                {locale.getPlainString(inherit ? "localizedMarkdown.keepOverride" : "localizedMarkdown.inherit")}
            </CMButton>
            <CMButton disabled={saving || uploading} onClick={onClose}>{locale.getPlainString("common.action.cancel")}</CMButton>
        </CMButtonGroup>
    </>;
}

function LocalizedMarkdownScope(props: LocalizedMarkdownProps) {
    const presentation = usePresentation();
    const locale = useLocale();
    const [editing, setEditing] = React.useState(false);
    const authorization = presentation.data?.authorization;
    const canEdit = !!authorization?.userPublicId
        && scopedAuthorizationSatisfiesRequirement(authorization, staticStringWritePermission(props.scope))
        && (props.scope === "global" || !!authorization.bandPublicId);
    const target = React.useMemo<StaticStringTarget>(() => ({
        key: props.id, scope: props.scope,
        bandPublicId: presentation.bandPublicId ?? null, localeTag: props.editLocale,
    }), [props.id, props.scope, presentation.bandPublicId, props.editLocale]);
    const enabled = presentation.data?.localization.availability[props.scope] ?? [];
    const resolvedText = locale.getStringDetail(props.id).value;
    const fallbackWhen = props.fallbackWhen ?? "null";
    const missing = resolvedText === null;
    const empty = resolvedText !== null && resolvedText.trim() === "";
    const useFallback = fallbackWhen === "null" && missing || fallbackWhen === "emptyString" && empty
        || fallbackWhen === "nullOrEmptyString" && (missing || empty);
    const text = useFallback ? props.fallbackMarkdown ?? null : resolvedText;
    const validDraftLocale = enabled.includes(props.editLocale);
    return <div className={`settingMarkdownContainer ${canEdit ? "editable" : ""}`} data-localized-markdown={props.id}>
        {editing ? <>
            <TextField select fullWidth label={locale.getPlainString("localizedMarkdown.locale")} value={props.editLocale}
                onChange={event => props.onEditLocaleChange(event.target.value)}>
                {!validDraftLocale && <MenuItem value={props.editLocale} disabled>{props.editLocale}</MenuItem>}
                {enabled.map(tag => <MenuItem key={tag} value={tag}>{tag}</MenuItem>)}
            </TextField>
            <div>{locale.getPlainString(props.scope === "band" ? "settings.scope.band" : "settings.scope.global")}</div>
            <LocalizedMarkdownEditor key={props.editLocale} target={target} canEdit={canEdit}
                canSetLocale={validDraftLocale}
                attachments={props.attachments} onClose={() => setEditing(false)} />
        </> : <>
            {canEdit && validDraftLocale && <CMButton onClick={() => setEditing(true)}>{locale.getPlainString("localizedMarkdown.edit")}</CMButton>}
            <Markdown markdown={text} />
        </>}
    </div>;
}

export function LocalizedMarkdown(props: LocalizedMarkdownProps) {
    const presentation = usePresentation();
    const identity = presentation.data?.authorization;
    const contextKey = JSON.stringify([props.id, props.scope, identity?.userPublicId,
    identity?.bandUserPublicId, presentation.data ? presentationContextKey(presentation.data.input) : null]);
    return <LocalizedMarkdownScope key={contextKey} {...props} />;
}

function BandLocalizedMarkdownScope({ id }: { readonly id: LocalizedMarkdownKey }) {
    const presentation = usePresentation();
    const catalog = presentation.data?.localization;
    const [editLocale, setEditLocale] = React.useState(() => catalog
        ? selectStaticStringEditLocale(catalog.preferences, catalog.availability.band) : "");
    return <LocalizedMarkdown id={id} scope="band" editLocale={editLocale} onEditLocaleChange={setEditLocale}
        attachments={{ kind: "band", fields: { visiblePermission: Permission.visibility_public } }} />;
}

/** Band chrome owns public attachments; global editors must explicitly disable band uploads. */
export function BandLocalizedMarkdown(props: { readonly id: LocalizedMarkdownKey }) {
    const presentation = usePresentation();
    const contextKey = presentation.data ? presentationContextKey(presentation.data.input) : "loading";
    return <BandLocalizedMarkdownScope key={contextKey} {...props} />;
}
