import React from "react";
import { useMutation } from "@blitzjs/rpc";
import { Alert, Checkbox, FormControl, FormControlLabel, FormHelperText, InputLabel, MenuItem, Select, Stack, Tooltip } from "@mui/material";
import setRoleDesignation from "src/auth/mutations/setRoleDesignation";
import type { SetRoleDesignation } from "src/auth/roleDesignations";
import type { BandRolePublicId, GlobalRolePublicId } from "shared/publicId";
import { useLocale } from "src/locale/components/useLocale";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { BandLocalizedMarkdown } from "src/setting/client/components/SettingMarkdown";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import { DB3AssociationMatrix } from "src/core/db3/components/DB3AssociationMatrix";
import { useDB3QueryContext } from "src/core/db3/components/useDB3Context";
import { gPermissionOrdered } from "shared/permissions";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { CMButton } from "../CMCoreComponents2";

// Role definitions are platform-owned; selected bands affect label resolution only.
const platformWriteContext = { bandPublicId: null };

export const globalRoleTableSpec = DB3Client.defineTableClientSpec({
    view: db3.globalRoleEditorView, columns: {
        publicId: DB3Client.publicIdFieldGen(),
        name: columnName => new DB3Client.LocalizedStringColumnClient({ columnName, fieldCaptionKey: "catalog.name" }),
        description: columnName => new DB3Client.LocalizedStringColumnClient({ columnName, fieldCaptionKey: "catalog.description" }),
        sortOrder: columnName => new DB3Client.GenericIntegerColumnClient({ columnName, cellWidth: 80, fieldCaptionKey: "catalog.sortOrder", fieldDescriptionKey: null }),
        color: columnName => new DB3Client.ColorColumnClient({ columnName, cellWidth: 120, fieldCaptionKey: "catalog.color", fieldDescriptionKey: null }),
        permissions: columnName => new DB3Client.TagsFieldClient({
            columnName, cellWidth: 300, allowDeleteFromCell: false,
            selectionView: db3.permissionEditorView, selectStyle: "dialog", fieldCaptionKey: "roles.permissions", fieldDescriptionKey: null
        }),
    }
});
export const bandRoleTableSpec = DB3Client.defineTableClientSpec({
    view: db3.bandRoleEditorView, columns: {
        publicId: DB3Client.publicIdFieldGen(),
        name: columnName => new DB3Client.LocalizedStringColumnClient({ columnName, fieldCaptionKey: "catalog.name" }),
        description: columnName => new DB3Client.LocalizedStringColumnClient({ columnName, fieldCaptionKey: "catalog.description" }),
        sortOrder: columnName => new DB3Client.GenericIntegerColumnClient({ columnName, cellWidth: 80, fieldCaptionKey: "catalog.sortOrder", fieldDescriptionKey: null }),
        color: columnName => new DB3Client.ColorColumnClient({ columnName, cellWidth: 120, fieldCaptionKey: "catalog.color", fieldDescriptionKey: null }),
        bandRolePermissions: columnName => new DB3Client.TagsFieldClient({
            columnName, cellWidth: 300, allowDeleteFromCell: false,
            selectionView: db3.permissionEditorView, selectStyle: "dialog", fieldCaptionKey: "roles.permissions", fieldDescriptionKey: null
        }),
    }
});

export function RoleDesignationControls() {
    const locale = useLocale();
    const dashboard = useDashboardContext();
    const presentation = usePresentation();
    const global = DB3Client.useDb3Query({ view: db3.globalRoleEditorView });
    const band = DB3Client.useDb3Query({ view: db3.bandRoleEditorView });
    const [setDesignation] = useMutation(setRoleDesignation);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [retryEdit, setRetryEdit] = React.useState<SetRoleDesignation | null>(null);
    const [drafts, setDrafts] = React.useState<{ sysadmin?: GlobalRolePublicId; public?: BandRolePublicId; newUsers?: BandRolePublicId }>({});
    const pending = React.useRef(false);
    const alive = React.useRef(true);
    React.useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; };
    }, []);
    const save = async (edit: SetRoleDesignation) => {
        if (pending.current) {
            return;
        }
        pending.current = true;
        setSaving(true);
        setError(null);
        setRetryEdit(null);
        let committed = false;
        try {
            await setDesignation(edit);
            committed = true;
            if (!alive.current) {
                return;
            }
            await Promise.all([global.refetch(), band.refetch(), dashboard.refreshCachedData(), presentation.invalidate()]);
            if (alive.current) {
                setDrafts(previous => ({ ...previous, [edit.designation]: undefined }));
            }
        } catch (reason) {
            console.error(reason);
            if (alive.current) {
                setError(locale.getPlainString(committed ? "roles.refreshFailed" : "roles.failed"));
                setRetryEdit(committed ? null : edit);
            }
        } finally {
            pending.current = false;
            if (alive.current) {
                setSaving(false);
            }
        }
    };
    const assignments = [
        { scope: "global", designation: "sysadmin", flag: "isSysAdminRole", label: "roles.sysadmin", rows: global.items },
        { scope: "band", designation: "public", flag: "isPublicRole", label: "roles.public", rows: band.items },
        { scope: "band", designation: "newUsers", flag: "isRoleForNewUsers", label: "roles.newUsers", rows: band.items },
    ] as const;
    return <Stack spacing={2}>
        <h3>{locale.getPlainString("roles.designations")}</h3>
        <Stack direction="row" useFlexGap flexWrap="wrap" spacing={2}>
            {assignments.map(assignment => {
                const matching = assignment.rows.filter(role => assignment.flag in role && role[assignment.flag]);
                const selected = drafts[assignment.designation] ?? (matching.length === 1 ? matching[0]!.publicId : "");
                const labelId = `role-designation-${assignment.designation}-label`;
                return <FormControl key={assignment.designation} error={matching.length !== 1} size="small" sx={{ minWidth: 240 }}>
                    <InputLabel id={labelId}>{locale.getPlainString(assignment.label)}</InputLabel>
                    <Select labelId={labelId} label={locale.getPlainString(assignment.label)} value={selected} disabled={saving}
                        onChange={event => {
                            const edit = assignment.scope === "global"
                                ? { scope: "global", designation: "sysadmin", roleId: db3.xGlobalRole.parseIdentity(event.target.value) } as const
                                : { scope: "band", designation: assignment.designation, roleId: db3.xBandRole.parseIdentity(event.target.value) } as const;
                            setDrafts(previous => ({ ...previous, [assignment.designation]: edit.roleId }));
                            void save(edit);
                        }}>
                        {assignment.rows.map(role => <MenuItem key={role.publicId} value={role.publicId}>{role.name.value}</MenuItem>)}
                    </Select>
                    {matching.length !== 1 && <FormHelperText>{locale.getPlainString("roles.invalidDesignation")}</FormHelperText>}
                </FormControl>;
            })}
        </Stack>
        {error && <Alert severity="error">{error}
            {retryEdit && <CMButton disabled={saving} onClick={() => void save(retryEdit)}>{locale.getPlainString("roles.retry")}</CMButton>}
        </Alert>}
    </Stack>;
}

export function RoleDefinitionsContent() {
    const locale = useLocale();
    const context = useDB3QueryContext();
    const dashboard = useDashboardContext();
    const presentation = usePresentation();
    const refreshPresentation = async () => { await presentation.invalidate(); };
    const scopeKey = `${context.bandPublicId}:${context.routeLocale}:${context.browserLanguages?.join(",")}`;
    return <Stack spacing={3} key={scopeKey}>
        <BandLocalizedMarkdown id="RolesAdminPage_markdown" />
        <RoleDesignationControls />
        <h3>{locale.getPlainString("roles.global")}</h3>
        <DB3EditGrid tableSpec={globalRoleTableSpec} view={db3.globalRoleEditorView} referenceProvider={dashboard.referenceStore}
            writeContext={platformWriteContext} onChanged={refreshPresentation} />
        <h3>{locale.getPlainString("roles.band")}</h3>
        <DB3EditGrid tableSpec={bandRoleTableSpec} view={db3.bandRoleEditorView} referenceProvider={dashboard.referenceStore}
            writeContext={platformWriteContext} onChanged={refreshPresentation} />
    </Stack>;
}

const globalRolesField = new DB3Client.TagsFieldClient<NonNullable<db3.DtoOf<typeof db3.permissionGlobalRoleMatrixView>["globalRoles"]>[number]>({
    columnName: "globalRoles", allowDeleteFromCell: false, selectionView: db3.globalRoleEditorView,
    selectStyle: "dialog", fieldCaptionKey: "roles.global", fieldDescriptionKey: null,
});
const bandRolesField = new DB3Client.TagsFieldClient<NonNullable<db3.DtoOf<typeof db3.permissionBandRoleMatrixView>["bandRolePermissions"]>[number]>({
    columnName: "bandRolePermissions", allowDeleteFromCell: false, selectionView: db3.bandRoleEditorView,
    selectStyle: "dialog", fieldCaptionKey: "roles.band", fieldDescriptionKey: null,
});
const globalMatrixSpec = DB3Client.defineTableClientSpec({
    view: db3.permissionGlobalRoleMatrixView, columns: {
        name: columnName => new DB3Client.GenericStringColumnClient({ columnName, fieldCaptionKey: "catalog.name", fieldDescriptionKey: null }),
        globalRoles: () => globalRolesField,
    }
});
const bandMatrixSpec = DB3Client.defineTableClientSpec({
    view: db3.permissionBandRoleMatrixView, columns: {
        name: columnName => new DB3Client.GenericStringColumnClient({ columnName, fieldCaptionKey: "catalog.name", fieldDescriptionKey: null }),
        bandRolePermissions: () => bandRolesField,
    }
});

export function RolePermissionMatrixContent() {
    const locale = useLocale();
    const dashboard = useDashboardContext();
    const presentation = usePresentation();
    const context = useDB3QueryContext();
    const scopeKey = `${context.bandPublicId}:${context.routeLocale}:${context.browserLanguages?.join(",")}`;
    const [scope, setScope] = React.useState<"global" | "band">("global");
    const [scopeSelectorOpen, setScopeSelectorOpen] = React.useState(false);
    const [changingScope, startScopeChange] = React.useTransition();
    const [showUnknown, setShowUnknown] = React.useState(false);
    const refreshAuthority = async () => {
        await Promise.all([dashboard.refreshCachedData(), presentation.invalidate()]);
    };
    const known = (name: string) => gPermissionOrdered.some(key => key === name);
    const filterRow = (row: { name: string }) => showUnknown || known(row.name);
    const renderExtraActions = ({ row }: { row: { name: string; sortOrder: number } }) => <Tooltip
        title={locale.getPlainString(known(row.name) ? "roles.knownPermission" : "roles.unknownPermission")}>
        <span>{row.sortOrder} {known(row.name) ? "🟢" : "🟥"}</span>
    </Tooltip>;
    return <Stack spacing={2}>
        <BandLocalizedMarkdown id="rolePermissionsMatrixPage_markdown" />
        <FormControl size="small" disabled={changingScope} sx={{ maxWidth: 300 }}><InputLabel id="role-matrix-scope">{locale.getPlainString("roles.title")}</InputLabel>
            <Select labelId="role-matrix-scope" label={locale.getPlainString("roles.title")} value={scope}
                open={scopeSelectorOpen} onOpen={() => setScopeSelectorOpen(true)} onClose={() => setScopeSelectorOpen(false)}
                onChange={event => {
                    // Close the portal before the next matrix query suspends this subtree.
                    setScopeSelectorOpen(false);
                    const selected = event.target.value === "band" ? "band" : "global";
                    startScopeChange(() => setScope(selected));
                }}>
                <MenuItem value="global">{locale.getPlainString("roles.global")}</MenuItem><MenuItem value="band">{locale.getPlainString("roles.band")}</MenuItem>
            </Select>
        </FormControl>
        <FormControlLabel label={locale.getPlainString("roles.unknown")} control={<Checkbox disabled={changingScope} checked={showUnknown} onChange={(_, checked) => setShowUnknown(checked)} />} />
        {changingScope && <span role="status">{locale.getPlainString("roles.loading")}</span>}
        {scope === "global" ? (
            <DB3AssociationMatrix
                key={`global:${scopeKey}`}
                localTableSpec={globalMatrixSpec}
                foreignTableSpec={globalRoleTableSpec}
                tagsField={globalRolesField}
                associationCommand={db3.setGlobalRolePermissionCommand}
                writeContext={platformWriteContext} disabled={changingScope}
                filterRow={filterRow} renderExtraActions={renderExtraActions}
                onChanged={refreshAuthority}
            />)
            : <DB3AssociationMatrix
                key={`band:${scopeKey}`}
                localTableSpec={bandMatrixSpec}
                foreignTableSpec={bandRoleTableSpec}
                tagsField={bandRolesField}
                associationCommand={db3.setBandRolePermissionCommand}
                writeContext={platformWriteContext}
                disabled={changingScope}
                filterRow={filterRow}
                renderExtraActions={renderExtraActions}
                onChanged={refreshAuthority}
            />}
    </Stack>;
}
