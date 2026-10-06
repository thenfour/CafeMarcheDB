import React from "react";
import { useQuery } from "@blitzjs/rpc";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { Permission } from "shared/permissions";
import type { UserTagPublicId } from "shared/publicId";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import { useDB3QueryContext } from "src/core/db3/components/useDB3Context";
import { useDB3Command } from "src/core/db3/components/useDB3Command";
import db3queries from "src/core/db3/queries/db3queries";
import { bandUserTagsCommand, bandUserTagsView, type BandUserTagsDto, type BandUserTagsEdit } from "src/core/db3/shared/entities/user/bandUserTags";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { CMStandardDBChip } from "../CMChip";
import { SelectionPicker } from "../select/SelectionPicker";
import { makeLocalSelectionSource } from "../select/selectionSource";
import { useMemberAssignmentSave } from "./useMemberAssignmentSave";

interface TagOption {
    readonly publicId: UserTagPublicId;
    readonly label: string;
    readonly available: boolean;
}

export function BandUserTagsEditor({ member, refetch }: {
    readonly member: BandUserTagsDto;
    readonly refetch: () => Promise<unknown>;
}) {
    const locale = useLocale();
    const dashboard = useDashboardContext();
    const presentation = usePresentation();
    const command = useDB3Command(bandUserTagsCommand);
    const [open, setOpen] = React.useState(false);
    const { save, saving, error, isPending } = useMemberAssignmentSave<BandUserTagsEdit>({
        execute: command.invoke, refetch, onCommitted: () => setOpen(false),
        messages: { saved: "membership.tags.saved", failed: "membership.tags.failed", refreshFailed: "membership.tags.refreshFailed" },
    });
    const visible: TagOption[] = dashboard.userTag.items
        .filter(tag => !tag.isHidden)
        .map(tag => ({ publicId: tag.publicId, label: tag.name, available: true }));
    const selected: TagOption[] = member.bandUserTagAssignments
        .map(assignment => visible.find(option => option.publicId === assignment.bandUserTagId)
            ?? { publicId: assignment.bandUserTagId, label: locale.getPlainString("membership.tags.unavailable"), available: false });
    const options = [...visible, ...selected.filter(option => !option.available)];
    const renderTag = (option: TagOption) => {
        const tag = dashboard.userTag.getById(option.publicId);
        return option.available && tag ? <CMStandardDBChip model={tag} size="small" /> : <Typography component="span">{option.label}</Typography>;
    };
    const canEdit = presentation.data?.authorization.effectivePermissionNames.includes(Permission.manage_users) ?? false;
    return <Stack spacing={1} aria-busy={saving}>
        {error && !open && <Alert severity="error">{error}</Alert>}
        {selected.length === 0 && <Typography>{locale.getPlainString("membership.tags.empty")}</Typography>}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>{selected.map(option => <React.Fragment key={option.publicId}>{renderTag(option)}</React.Fragment>)}</Box>
        {canEdit && <Button disabled={saving} onClick={() => setOpen(true)}>{locale.getPlainString("membership.tags.edit")}</Button>}
        {saving && <Typography role="status">{locale.getPlainString("membership.tags.saving")}</Typography>}
        {open && <SelectionPicker
            source={makeLocalSelectionSource({ items: options, getKey: option => option.publicId, getLabel: option => option.label, renderValue: renderTag })}
            multiple closeOnSelect={false} busy={saving} value={selected}
            title={locale.getPlainString("membership.tags.edit")}
            description={<Stack spacing={1}>
                <Typography>{locale.getPlainString("membership.tags.hidden")}</Typography>
                {error && <Alert severity="error">{error}</Alert>}
            </Stack>}
            onCancel={() => {
                if (!isPending()) {
                    setOpen(false);
                }
            }}
            onAccept={values => { void save({ membershipId: member.publicId, tagIds: values.map(option => option.publicId) }); }}
        />}
    </Stack>;
}

function LoadedMemberTags() {
    const context = useDB3QueryContext();
    const [result, { refetch }] = useQuery(db3queries, {
        ...context,
        table: { tableID: bandUserTagsView.tableID, tableName: bandUserTagsView.tableName, viewID: bandUserTagsView.viewID },
        filter: { items: [] }, cmdbQueryContext: "member tags",
    }, { staleTime: 0, cacheTime: 0, keepPreviousData: false });
    const members = result.items.map(item => bandUserTagsView.parseDto(item));
    return <Stack spacing={3}>{members.map(member => <Box key={member.publicId}>
        <Typography variant="h6">{member.user.name}</Typography>
        <BandUserTagsEditor member={member} refetch={refetch} />
    </Box>)}</Stack>;
}

export function MemberTagsControl() {
    const locale = useLocale();
    const presentation = usePresentation();
    if (!presentation.bandPublicId) {
        return <Alert severity="info">{locale.getPlainString("membership.tags.noBand")}</Alert>;
    }
    const contextKey = `${presentation.bandPublicId}/${presentation.data?.authorization.bandUserPublicId ?? "members"}/${presentation.data?.input.clientRequestId ?? "initial"}`;
    return <LoadedMemberTags key={contextKey} />;
}
