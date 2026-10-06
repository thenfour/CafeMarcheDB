import { useMutation, useQuery } from "@blitzjs/rpc";
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, TextField } from "@mui/material";
import React from "react";
import { Permission } from "shared/permissions";
import { parsePublicId, type BandPublicId } from "shared/publicId";
import { Markdown } from "src/core/components/markdown/Markdown";
import { useLocale } from "src/locale/components/useLocale";
import { invalidatePresentation, usePresentation } from "src/locale/components/PresentationProvider";
import { instrumentStrings } from "src/locale/shared/instrumentStrings";
import type { LocalePreferenceInput } from "src/locale/shared/localePreferences";
import executeDB3Command from "../mutations/executeDB3Command";
import getBandInstrumentCatalog from "../queries/getBandInstrumentCatalog";
import type { BandInstrumentCatalog as CatalogData } from "../server/bandInstrumentCatalog";
import { DB3ReferenceStore } from "../shared/core/db3Hydration";
import { queryResolvedCatalog } from "../shared/core/resolvedCatalogQuery";
import {
    bandInstrumentCommand, bandInstrumentReferences, bandInstrumentView, xBandInstrumentFunctionalGroup,
    type BandInstrumentCommand, type BandInstrumentDto, type BandInstrumentGroupDto
} from "../shared/entities/instrument/bandInstrumentContracts";
import { buildInstrumentCatalogCommand } from "../shared/entities/instrument/bandInstrumentDraft";

type CatalogLabel = keyof typeof instrumentStrings;
type Entry = BandInstrumentDto | BandInstrumentGroupDto;
export interface CatalogEditorProps {
    readonly mode: "instrument" | "group";
    readonly entry?: Entry;
    readonly groups: readonly BandInstrumentGroupDto[];
    readonly locales: readonly string[];
    readonly save: (command: BandInstrumentCommand) => Promise<void>;
    readonly close: () => void;
    readonly label: (key: CatalogLabel) => string;
}

function textForEditing(entry: Entry | undefined, field: "name" | "description", localeTag: string): string {
    const resolution = field === "name" ? entry?.nameResolution : entry?.descriptionResolution;
    return resolution?.localeTag === localeTag ? entry?.[field] ?? "" : "";
}

/** Ordinary name edits stay explicit about locale, scope, and the field's current identity. */
export function InstrumentCatalogEditor({ mode, entry, groups, locales, save, close, label }: CatalogEditorProps) {
    const [localeTag, setLocale] = React.useState(entry?.nameResolution.localeTag ?? locales[0] ?? "en-US");
    const [name, setName] = React.useState(textForEditing(entry, "name", localeTag));
    const [description, setDescription] = React.useState(textForEditing(entry, "description", localeTag));
    const [nameChanged, setNameChanged] = React.useState(!entry);
    const [descriptionChanged, setDescriptionChanged] = React.useState(!entry);
    const [inheritName, setInheritName] = React.useState(false);
    const [inheritDescription, setInheritDescription] = React.useState(false);
    const [groupId, setGroupId] = React.useState(entry && "functionalGroupId" in entry ? entry.functionalGroupId : groups[0]?.publicId);
    const [color, setColor] = React.useState(entry && "colorOverride" in entry ? entry.colorOverride ?? "" : "");
    const [matcher, setMatcher] = React.useState(entry && "autoAssignFileLeafRegexOverride" in entry ? entry.autoAssignFileLeafRegexOverride ?? "" : "");
    const [sortOrder, setSortOrder] = React.useState(entry?.sortOrderOverride == null ? "" : String(entry.sortOrderOverride));
    const [hidden, setHidden] = React.useState(entry?.isHidden ?? false);
    const [error, setError] = React.useState<string | null>(null);
    const [saving, setSaving] = React.useState(false);
    const needsLocale = !entry || (nameChanged && !inheritName) || (descriptionChanged && !inheritDescription);
    const submit = async () => {
        setError(null); setSaving(true);
        try {
            const command = buildInstrumentCatalogCommand({
                mode,
                entry,
                localeTag,
                name, description,
                nameChanged,
                descriptionChanged,
                inheritName,
                inheritDescription,
                groupId,
                color,
                matcher,
                sortOrder,
                hidden,
            });
            await save(command);
            close();
        } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
        finally { setSaving(false); }
    };
    return <Dialog open onClose={saving ? undefined : close} fullWidth>
        <DialogTitle>{label(entry ? "instrument.edit" : "instrument.add")}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField select label={label("instrument.locale")} value={localeTag} onChange={event => {
                const tag = event.target.value;
                setLocale(tag); setName(textForEditing(entry, "name", tag)); setDescription(textForEditing(entry, "description", tag));
                setNameChanged(!entry); setDescriptionChanged(!entry);
            }}>{!locales.includes(localeTag) && <MenuItem value={localeTag} disabled>{localeTag}</MenuItem>}
                {locales.map(tag => <MenuItem key={tag} value={tag}>{tag}</MenuItem>)}</TextField>
            <TextField label={label("instrument.name")} value={name} disabled={inheritName} onChange={event => { setName(event.target.value); setNameChanged(true); }} />
            {entry?.globalPublicId && entry.nameStringPublicId && <FormControlLabel control={<Checkbox checked={inheritName} onChange={(_event, checked) => setInheritName(checked)} />} label={label("instrument.inherit")} />}
            <TextField label={label("instrument.description")} value={description} multiline disabled={inheritDescription} onChange={event => { setDescription(event.target.value); setDescriptionChanged(true); }} />
            {entry?.globalPublicId && entry.descriptionStringPublicId && <FormControlLabel control={<Checkbox checked={inheritDescription} onChange={(_event, checked) => setInheritDescription(checked)} />} label={label("instrument.inherit")} />}
            {mode === "instrument" ? <>
                <TextField select label={label("instrument.group")} value={groupId ?? ""} onChange={event => {
                    const group = groups.find(candidate => candidate.publicId === event.target.value);
                    setGroupId(group?.publicId);
                }}>{groups.map(group => <MenuItem key={group.publicId} value={group.publicId}>{group.name ?? label("instrument.missing")}</MenuItem>)}</TextField>
                <TextField label={label("instrument.matcher")} value={matcher} onChange={event => setMatcher(event.target.value)} />
            </> : <TextField label={label("instrument.color")} value={color} onChange={event => setColor(event.target.value)} />}
            <TextField type="number" label={label("instrument.sortOrder")} value={sortOrder} onChange={event => setSortOrder(event.target.value)} />
            {entry && <FormControlLabel control={<Checkbox checked={hidden} onChange={(_event, checked) => setHidden(checked)} />} label={label("instrument.hidden")} />}
        </Stack></DialogContent>
        <DialogActions><Button onClick={close} disabled={saving}>{label("instrument.cancel")}</Button>
            <Button onClick={() => void submit()} disabled={saving || (needsLocale && !locales.includes(localeTag))}>{label("instrument.save")}</Button></DialogActions>
    </Dialog>;
}

function LoadedCatalog({ mode, bandPublicId, preferences, detailPublicId }: {
    mode: "instrument" | "group";
    bandPublicId: BandPublicId;
    preferences: LocalePreferenceInput;
    detailPublicId?: string;
}) {
    const locale = useLocale();
    const presentation = usePresentation();
    const label = (key: CatalogLabel) => locale.getPlainString(key);
    const canManage = presentation.data?.authorization.effectivePermissionNames.includes(Permission.admin_instruments) ?? false;
    const [includeHidden, setIncludeHidden] = React.useState(false);

    const [data] = useQuery(getBandInstrumentCatalog, {
        bandPublicId, routeLocale: preferences.routeLocale,
        browserLanguages: [...(preferences.browserLanguages ?? [])], includeHidden
    }, { cacheTime: 0, staleTime: 0, keepPreviousData: false });

    const [mutate] = useMutation(executeDB3Command);
    const [draft, setDraft] = React.useState<Entry | "new" | null>(null);
    const [search, setSearch] = React.useState("");
    const [page, setPage] = React.useState(0);
    const [error, setError] = React.useState<string | null>(null);

    const save = async (command: BandInstrumentCommand) => {
        await mutate({ commandID: bandInstrumentCommand.commandID, bandPublicId, payload: bandInstrumentCommand.serialize(command) });
        await invalidatePresentation();
    };
    const store = new DB3ReferenceStore(bandInstrumentReferences);
    store.register(xBandInstrumentFunctionalGroup, data.groups);
    const instruments = data.instruments.map(dto => bandInstrumentView.hydrate(dto, store));

    if (detailPublicId) {
        const instrument = instruments.find(row => row.publicId === detailPublicId);
        return instrument ? <><h1 lang={instrument.nameResolution.localeTag ?? undefined}>{instrument.name ?? label("instrument.missing")}</h1>
            <p lang={instrument.functionalGroup.nameResolution.localeTag ?? undefined}>{instrument.functionalGroup.name ?? label("instrument.missing")}</p>
            <div lang={instrument.descriptionResolution.localeTag ?? undefined}><Markdown markdown={instrument.description ?? ""} /></div></> : <Alert severity="warning">{label("instrument.notFound")}</Alert>;
    }

    const rows: readonly Entry[] = mode === "instrument" ? instruments : data.groups;
    const result = queryResolvedCatalog(rows, { search, sort: "name", skip: page * 25, take: 25 }, locale.formattingLocale ?? "en-US");
    const globalRows: CatalogData["globalInstruments"] = mode === "instrument" ? data.globalInstruments : data.globalGroups;

    return <Stack spacing={2}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField label={label("instrument.search")} value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} />
        {canManage && <><Button onClick={() => setDraft("new")}>{label("instrument.add")}</Button>
            <FormControlLabel control={<Checkbox checked={includeHidden} onChange={(_event, checked) => { setIncludeHidden(checked); setPage(0); }} />} label={label("instrument.showHidden")} />
            <TextField select label={label("instrument.optIn")} value="" onChange={event => {
                void save({ kind: mode === "instrument" ? "optInInstrument" : "optInGroup", globalPublicId: parsePublicId(event.target.value) })
                    .catch(reason => setError(reason instanceof Error ? reason.message : String(reason)));
            }}>{globalRows.map(row => <MenuItem key={row.publicId} value={row.publicId}>{row.name ?? label("instrument.missing")}</MenuItem>)}</TextField></>}
        <table>
            <thead>
                <tr><th>{label("instrument.name")}</th><th>{label(mode === "instrument" ? "instrument.group" : "instrument.color")}</th><th>{label("instrument.edit")}</th></tr>
            </thead>
            <tbody>
                {
                    result.items.map(row => <tr key={row.publicId}>
                        <td lang={row.nameResolution.localeTag ?? undefined}>{mode === "instrument" ? <a href={`/backstage/instrument/${row.publicId}?${new URLSearchParams({
                            bandPublicId,
                            ...(preferences.routeLocale ? { routeLocale: preferences.routeLocale } : {})
                        })}`}>{row.name ?? label("instrument.missing")}</a> : row.name ?? label("instrument.missing")}</td>
                        <td>{"functionalGroupId" in row ? data.groups.find(group => group.publicId === row.functionalGroupId)?.name : row.color}</td>
                        <td>{canManage && <Button onClick={() => setDraft(row)}>{label("instrument.edit")}</Button>}</td>
                    </tr>)
                }
            </tbody>
        </table>
        <Stack direction="row">
            <Button disabled={page === 0} onClick={() => setPage(value => value - 1)}>{label("instrument.previous")}</Button>
            <Button disabled={(page + 1) * 25 >= result.count} onClick={() => setPage(value => value + 1)}>{label("instrument.next")}</Button>
        </Stack>
        {draft && <InstrumentCatalogEditor
            mode={mode}
            entry={draft === "new" ? undefined : draft}
            groups={data.groups}
            locales={presentation.data?.localization.availability.band ?? []}
            label={label}
            save={save}
            close={() => setDraft(null)}
        />}
    </Stack>;
}

export function BandInstrumentCatalog({ mode = "instrument", detailPublicId }: {
    mode?: "instrument" | "group";
    detailPublicId?: string
}) {
    const presentation = usePresentation();
    const locale = useLocale();
    const bandPublicId = presentation.bandPublicId;
    if (!bandPublicId) {
        return <Alert severity="info">{locale.getPlainString("instrument.noBand")}</Alert>;
    }
    const input = presentation.data?.input ?? {};
    const preferences = {
        routeLocale: input.routeLocale,
        browserLanguages: input.browserLanguages,
    };
    return <React.Suspense fallback={<span role="status">{locale.getPlainString("instrument.loading")}</span>}>
        <LoadedCatalog
            key={JSON.stringify({ bandPublicId, preferences })}
            mode={mode}
            bandPublicId={bandPublicId}
            preferences={preferences}
            detailPublicId={detailPublicId}
        />
    </React.Suspense>;
}
