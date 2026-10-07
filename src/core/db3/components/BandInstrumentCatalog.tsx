import { invalidateQuery, useMutation, useQuery } from "@blitzjs/rpc";
import { Alert, Checkbox, FormControlLabel, MenuItem, Stack, TextField } from "@mui/material";
import React from "react";
import { Permission } from "shared/permissions";
import { parsePublicId } from "shared/publicId";
import { Markdown } from "src/core/components/markdown/Markdown";
import { useDashboardContext } from "src/core/components/dashboardContext/DashboardContext";
import { useLocale } from "src/locale/components/useLocale";
import { usePresentation } from "src/locale/components/PresentationProvider";
import executeDB3Command from "../mutations/executeDB3Command";
import getBandInstrumentCatalog from "../queries/getBandInstrumentCatalog";
import db3queries from "../queries/db3queries";
import db3paginatedQueries from "../queries/db3paginatedQueries";
import {
    bandInstrumentCommand, bandInstrumentView, bandInstrumentGroupView,
} from "../shared/entities/instrument/bandInstrumentContracts";
import { defineTableClientSpec } from "./DB3ClientCore";
import { GenericStringColumnClient, GenericIntegerColumnClient, ColorColumnClient, BoolColumnClient } from "./DB3ClientBasicFields";
import { LocalizedStringColumnClient, InheritedColumnClient } from "./DB3CatalogFields";
import { ForeignSingleFieldClient } from "./db3ForeignSingleFieldClient";
import { DB3EditGrid } from "./db3DataGrid";
import { useDB3QueryContext } from "./useDB3Context";

const commonColumns = {
    name: (columnName: string) => new LocalizedStringColumnClient({ columnName, fieldCaptionKey: "instrument.name" }),
    description: (columnName: string) => new LocalizedStringColumnClient({ columnName, fieldCaptionKey: "instrument.description" }),
    sortOrder: (columnName: string) => new InheritedColumnClient(new GenericIntegerColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "instrument.sortOrder", columnName, cellWidth: 80 }), { fieldCaptionKey: "instrument.sortOrder" }),
    isHidden: (columnName: string) => new BoolColumnClient({ columnName, fieldCaptionKey: "instrument.hidden", fieldDescriptionKey: null }),
};
export const bandInstrumentGroupTableSpec = defineTableClientSpec({
    view: bandInstrumentGroupView, columns: {
        ...commonColumns,
        color: columnName => new InheritedColumnClient(new ColorColumnClient({ fieldDescriptionKey: null, fieldCaptionKey: "instrument.color", columnName, cellWidth: 250 }), { fieldCaptionKey: "instrument.color" }),
    },
});
export const bandInstrumentTableSpec = defineTableClientSpec({
    view: bandInstrumentView, columns: {
        ...commonColumns,
        autoAssignFileLeafRegex: columnName => new InheritedColumnClient(new GenericStringColumnClient({
            columnName,
            fieldCaptionKey: "instrument.matcher", fieldDescriptionKey: null
        }), { fieldCaptionKey: "instrument.matcher" }),
        functionalGroup: columnName => new ForeignSingleFieldClient({ fieldDescriptionKey: null, fieldCaptionKey: "instrument.group",
            columnName,
            selectionView: bandInstrumentGroupView
        }),
    },
});

function LoadedCatalog({ mode }: { readonly mode: "instrument" | "group" }) {
    const locale = useLocale();
    const dashboard = useDashboardContext();
    const presentation = usePresentation();
    const context = useDB3QueryContext();
    const canManage = presentation.data?.authorization.effectivePermissionNames.includes(Permission.admin_instruments) ?? false;
    const [includeHidden, setIncludeHidden] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [data, { refetch }] = useQuery(getBandInstrumentCatalog, {
        bandPublicId: parsePublicId<"Band">(context.bandPublicId!),
        routeLocale: context.routeLocale, browserLanguages: context.browserLanguages
    },
        { cacheTime: 0, staleTime: 0, keepPreviousData: false });
    const [mutate] = useMutation(executeDB3Command);
    const optIn = async (publicId: string) => {
        setError(null);
        try {
            await mutate({
                commandID: bandInstrumentCommand.commandID, bandPublicId: context.bandPublicId,
                payload: bandInstrumentCommand.serialize({ kind: mode === "instrument" ? "optInInstrument" : "optInGroup", globalPublicId: parsePublicId(publicId) })
            });
            await Promise.all([dashboard.refreshCachedData(), refetch(),
                invalidateQuery(db3queries), invalidateQuery(db3paginatedQueries)]);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
        }
    };
    const globalRows = mode === "instrument" ? data.globalInstruments : data.globalGroups;
    return <Stack spacing={2}>
        {error && <Alert severity="error">{error}</Alert>}
        {canManage && <>
            <FormControlLabel label={locale.getPlainString("instrument.showHidden")}
                control={<Checkbox checked={includeHidden} onChange={(_event, checked) => setIncludeHidden(checked)} />} />
            <TextField select label={locale.getPlainString("instrument.optIn")} value="" onChange={event => { void optIn(event.target.value); }}>
                {globalRows.map(row => <MenuItem key={row.publicId} value={row.publicId}>{row.name ?? locale.getPlainString("instrument.missing")}</MenuItem>)}
            </TextField>
        </>}
        {mode === "instrument" ? <DB3EditGrid key={`instrument/${includeHidden}`} view={bandInstrumentView} tableSpec={bandInstrumentTableSpec}
            referenceProvider={dashboard.referenceStore} tableParams={{ includeHidden }} readOnly={!canManage} />
            : <DB3EditGrid key={`group/${includeHidden}`} view={bandInstrumentGroupView} tableSpec={bandInstrumentGroupTableSpec}
                referenceProvider={dashboard.referenceStore} tableParams={{ includeHidden }} readOnly={!canManage} />}
    </Stack>;
}

function LoadedDetail({ publicId }: { readonly publicId: string }) {
    const locale = useLocale();
    const dashboard = useDashboardContext();
    const instrument = dashboard.instrument.getById(parsePublicId<"Instrument">(publicId));
    const group = instrument?.functionalGroup;
    return instrument ? <>
        <h1 lang={instrument.nameResolution.localeTag ?? undefined}>{instrument.name ?? locale.getPlainString("instrument.missing")}</h1>
        <p lang={group?.nameResolution.localeTag ?? undefined}>{group?.name ?? locale.getPlainString("instrument.missing")}</p>
        <div lang={instrument.descriptionResolution.localeTag ?? undefined}><Markdown markdown={instrument.description ?? ""} /></div>
    </> : <Alert severity="warning">{locale.getPlainString("instrument.notFound")}</Alert>;
}

export function BandInstrumentCatalog({ mode = "instrument", detailPublicId }: {
    readonly mode?: "instrument" | "group";
    readonly detailPublicId?: string;
}) {
    const presentation = usePresentation();
    const locale = useLocale();
    if (!presentation.bandPublicId) {
        return <Alert severity="info">{locale.getPlainString("instrument.noBand")}</Alert>;
    }
    return <React.Suspense fallback={<span role="status">{locale.getPlainString("instrument.loading")}</span>}>
        {detailPublicId ? <LoadedDetail publicId={detailPublicId} /> : <LoadedCatalog mode={mode} />}
    </React.Suspense>;
}
