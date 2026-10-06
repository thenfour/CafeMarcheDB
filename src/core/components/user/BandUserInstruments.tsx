import React from "react";
import { useQuery } from "@blitzjs/rpc";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { Permission } from "shared/permissions";
import type { BandUserPublicId, InstrumentPublicId } from "shared/publicId";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import { useDB3QueryContext } from "src/core/db3/components/useDB3Context";
import { useDB3Command } from "src/core/db3/components/useDB3Command";
import db3queries from "src/core/db3/queries/db3queries";
import { bandUserInstrumentsCommand, bandUserInstrumentsView, type BandUserInstrumentsDto, type BandUserInstrumentsEdit } from "src/core/db3/shared/entities/user/bandUserInstruments";
import { useDashboardContext, useFeatureRecorder } from "../dashboardContext/DashboardContext";
import { ActivityFeature } from "../featureReports/activityTracking";
import type { InstrumentDashboardClient } from "src/core/db3/shared/entities/instrument/instrumentViews";
import { InstrumentChip } from "../CMCoreComponents";
import { SelectionPicker } from "../select/SelectionPicker";
import { makeLocalSelectionSource } from "../select/selectionSource";
import { useMemberAssignmentSave } from "./useMemberAssignmentSave";

interface InstrumentOption {
    readonly publicId: InstrumentPublicId;
    readonly label: string;
    readonly available: boolean;
}

function instrumentSelectionOptions(member: BandUserInstrumentsDto,
    catalog: readonly Pick<InstrumentDashboardClient, "publicId" | "name" | "isHidden" | "functionalGroup">[], unavailableLabel: string,
) {
    const visible: InstrumentOption[] = catalog.filter(instrument => !instrument.isHidden && !instrument.functionalGroup.isHidden).map(instrument => ({
        publicId: instrument.publicId, label: instrument.name, available: true,
    }));
    const selected: InstrumentOption[] = member.bandUserInstruments.map(association => visible.find(option => option.publicId === association.bandInstrumentId)
        ?? { publicId: association.bandInstrumentId, label: unavailableLabel, available: false });
    const primary = member.bandUserInstruments.find(association => association.isPrimary) ?? member.bandUserInstruments[0];
    return {
        selected, options: [...visible, ...selected.filter(option => !option.available)],
        primaryOption: selected.find(option => option.publicId === primary?.bandInstrumentId),
    };
}

export function BandUserInstrumentsEditor({ member, refetch }: {
    readonly member: BandUserInstrumentsDto;
    readonly refetch: () => Promise<unknown>;
}) {
    const locale = useLocale();
    const dashboard = useDashboardContext();
    const presentation = usePresentation();
    const command = useDB3Command(bandUserInstrumentsCommand);
    const recordFeature = useFeatureRecorder();
    const [dialog, setDialog] = React.useState<"instruments" | "primary" | null>(null);
    const { selected, options, primaryOption } = instrumentSelectionOptions(member, dashboard.instrument.items,
        locale.getPlainString("membership.instruments.unavailable"));
    const renderInstrument = (option: InstrumentOption) => option.available
        ? <InstrumentChip value={option.publicId} size="big" />
        : <Typography component="span">{option.label}</Typography>;
    const { save, saving, error, isPending } = useMemberAssignmentSave<BandUserInstrumentsEdit>({
        execute: command.invoke, refetch,
        messages: { saved: "membership.instruments.saved", failed: "membership.instruments.failed", refreshFailed: "membership.instruments.refreshFailed" },
        onCommitted: edit => {
            setDialog(null);
            if (presentation.data?.authorization.bandUserPublicId === member.publicId) {
                void recordFeature({ feature: edit.kind === "setPrimary"
                    ? ActivityFeature.profile_change_default_instrument : ActivityFeature.profile_change_instrument });
            }
        },
    });
    const canEdit = presentation.data?.authorization.bandUserPublicId === member.publicId
        || (presentation.data?.authorization.effectivePermissionNames.includes(Permission.manage_users) ?? false);
    return <Stack spacing={1} aria-busy={saving}>
        {error && !dialog && <Alert severity="error">{error}</Alert>}
        {selected.length === 0 && <Typography>{locale.getPlainString("membership.instruments.empty")}</Typography>}
        {selected.map(option => <Box key={option.publicId} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {renderInstrument(option)}
            {selected.length > 1 && option.publicId === primaryOption?.publicId
                && <Typography variant="caption">{locale.getPlainString("membership.instruments.default")}</Typography>}
        </Box>)}
        {canEdit && <Box>
            <Button disabled={saving} onClick={() => setDialog("instruments")}>
                {locale.getPlainString(selected.length ? "membership.instruments.edit" : "membership.instruments.select")}
            </Button>
            {selected.length > 1 && <Button disabled={saving} onClick={() => setDialog("primary")}>
                {locale.getPlainString("membership.instruments.changeDefault")}
            </Button>}
        </Box>}
        {saving && <Typography role="status">{locale.getPlainString("membership.instruments.saving")}</Typography>}
        {dialog && <SelectionPicker
            source={makeLocalSelectionSource({ items: dialog === "primary" ? selected : options,
                getKey: option => option.publicId, getLabel: option => option.label, renderValue: renderInstrument })}
            multiple={dialog === "instruments"} closeOnSelect={false}
            busy={saving}
            value={dialog === "primary" ? (primaryOption ? [primaryOption] : []) : selected}
            title={locale.getPlainString(dialog === "primary" ? "membership.instruments.defaultTitle" : "membership.instruments.edit")}
            description={<Stack spacing={1}>
                <Typography>{locale.getPlainString(dialog === "primary" ? "membership.instruments.defaultDescription" : "membership.instruments.hidden")}</Typography>
                {error && <Alert severity="error">{error}</Alert>}
            </Stack>}
            onCancel={() => {
                if (!isPending()) {
                    setDialog(null);
                }
            }}
            onAccept={values => {
                if (dialog === "primary") {
                    const value = values[0];
                    if (value) {
                        void save({ kind: "setPrimary", membershipId: member.publicId, instrumentId: value.publicId });
                    }
                    return;
                }
                void save({ kind: "replace", membershipId: member.publicId, instrumentIds: values.map(option => option.publicId) });
            }}
        />}
    </Stack>;
}

function LoadedMemberInstruments({ membershipId }: { readonly membershipId?: BandUserPublicId }) {
    const locale = useLocale();
    const context = useDB3QueryContext();
    const [result, { refetch }] = useQuery(db3queries, {
        ...context,
        table: { tableID: bandUserInstrumentsView.tableID, tableName: bandUserInstrumentsView.tableName, viewID: bandUserInstrumentsView.viewID },
        filter: { items: [], ...(membershipId ? { publicIds: [membershipId] } : {}) },
        cmdbQueryContext: "member instruments",
    }, { staleTime: 0, cacheTime: 0, keepPreviousData: false });
    const members = result.items.map(item => bandUserInstrumentsView.parseDto(item));
    return <Stack spacing={3}>
        {membershipId && members.length === 0 && <Alert severity="info">{locale.getPlainString("membership.instruments.notFound")}</Alert>}
        {members.map(member => <Box key={member.publicId}>
            {!membershipId && <Typography variant="h6">{member.user.name}</Typography>}
            <BandUserInstrumentsEditor member={member} refetch={refetch} />
        </Box>)}
    </Stack>;
}

export function MemberInstrumentsControl({ own }: { readonly own: boolean }) {
    const locale = useLocale();
    const presentation = usePresentation();
    const membershipId = presentation.data?.authorization.bandUserPublicId;
    if (!presentation.bandPublicId) {
        return <Alert severity="info">{locale.getPlainString("membership.instruments.noBand")}</Alert>;
    }
    if (own && !membershipId) {
        return <Alert severity="info">{locale.getPlainString("membership.instruments.noMembership")}</Alert>;
    }
    const contextKey = `${presentation.bandPublicId}/${membershipId ?? "members"}/${presentation.data?.input.clientRequestId ?? "initial"}`;
    return <LoadedMemberInstruments key={contextKey} membershipId={own ? membershipId ?? undefined : undefined} />;
}
