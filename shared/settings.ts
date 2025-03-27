import db from "db";
import { Ctx } from "@blitzjs/next";
import { ChangeAction, CreateChangeContext, RegisterChange } from "./activityLog";

// SETTINGS /////////////////////////////////////////////////////////////////////////////////////////////////////////
// for use on the server only.
// if you need to get / set settings on client, useQuery is required.

export enum Setting {
    // event dialog text
    EditEventDialogDescription = "EditEventDialogDescription",
    NewEventSegmentDialogTitle = "NewEventSegmentDialogTitle",
    EditEventSegmentDialogTitle = "EditEventSegmentDialogTitle",
    NewEventSegmentDialogDescription = "NewEventSegmentDialogDescription",
    EditEventSegmentDialogDescription = "EditEventSegmentDialogDescription",
    NewEventDialogDescription = "NewEventDialogDescription",
    EditSongDialogDescription = "EditSongDialogDescription",
    IconEditCellDialogDescription = "IconEditCellDialogDescription",
    VisibilityControlSelectDialogDescription = "VisibilityControlSelectDialogDescription",
    EventInviteUsersDialogDescriptionMarkdown = "EventInviteUsersDialogDescriptionMarkdown",
    EventAttendanceEditDialog_TitleMarkdown = "EventAttendanceEditDialog_TitleMarkdown",
    EventAttendanceEditDialog_DescriptionMarkdown = "EventAttendanceEditDialog_DescriptionMarkdown",
    EditEventSongListDialogDescription = "EditEventSongListDialogDescription",
    EditEventSongListDialogTitle = "EditEventSongListDialogTitle",
    EventAttendanceCommentDialog_TitleMarkdown = "EventAttendanceCommentDialog_TitleMarkdown",
    EventAttendanceCommentDialog_DescriptionMarkdown = "EventAttendanceCommentDialog_DescriptionMarkdown",

    // mostly pages or sections of pages...
    HomeDescription = "HomeDescription",
    event_description_mockup_markdown = "event_description_mockup_markdown",
    EditEventAttendancesPage_markdown = "EditEventAttendancesPage_markdown",
    editEvents_markdown = "editEvents_markdown",
    EditEventSegmentsPage_markdown = "EditEventSegmentsPage_markdown",
    EventSegmentUserResponsePage_markdown = "EventSegmentUserResponsePage_markdown",
    EditEventSongListsPage_markdown = "EditEventSongListsPage_markdown",
    EditEventSongListSongsPage_markdown = "EditEventSongListSongsPage_markdown",
    EditEventStatusesPage_markdown = "EditEventStatusesPage_markdown",
    EditEventTagsPage_markdown = "EditEventTagsPage_markdown",
    EditEventTypesPage_markdown = "EditEventTypesPage_markdown",
    EventUserResponsePage_markdown = "EventUserResponsePage_markdown",
    EditFilesPage_markdown = "EditFilesPage_markdown",
    EditFileTagsPage_markdown = "EditFileTagsPage_markdown",
    EditFrontpageGalleryItemsPage_markdown = "EditFrontpageGalleryItemsPage_markdown",
    EditSongCreditsPage_markdown = "EditSongCreditsPage_markdown",
    editSongCreditTypes_markdown = "editSongCreditTypes_markdown",
    editSongs_markdown = "editSongs_markdown",
    editSongTags_markdown = "editSongTags_markdown",
    EditUserTagsPage_markdown = "EditUserTagsPage_markdown",
    events_markdown = "events_markdown",
    frontpage_gallery_markdown = "frontpage_gallery_markdown",
    info_text = "info_text",
    InstrumentFunctionalGroupList_markdown = "InstrumentFunctionalGroupList_markdown",
    instrumentList_markdown = "instrumentList_markdown",
    instrumentTagList_markdown = "instrumentTagList_markdown",
    profile_markdown = "profile_markdown",
    rolePermissionsMatrixPage_markdown = "rolePermissionsMatrixPage_markdown",
    RolesAdminPage_markdown = "RolesAdminPage_markdown",
    settings_markdown = "settings_markdown",
    songs_markdown = "songs_markdown",
    usersearch_markdown = "usersearch_markdown",
    AdminLogsPage_markdown = "AdminLogsPage_markdown",
    UserInstrumentsPage_markdown = "UserInstrumentsPage_markdown",
    EventSongListTabDescription = "EventSongListTabDescription",
    EventAttendanceDetailMarkdown = "EventAttendanceDetailMarkdown",
    EventCompletenessTabMarkdown = "EventCompletenessTabMarkdown",
    FrontpageAgendaPage_markdown = "FrontpageAgendaPage_markdown",
    BackstageFrontpageMarkdown = "BackstageFrontpageMarkdown",
    BackstageFrontpageHeaderMarkdown = "BackstageFrontpageHeaderMarkdown",
    DashboardStats_SongsMarkdown = "DashboardStats_SongsMarkdown",
    DashboardStats_EventsMarkdown = "DashboardStats_EventsMarkdown",
    CustomLinksPageMarkdown = "CustomLinksPageMarkdown",
    MenuLinksPageMarkdown = "MenuLinksPageMarkdown",
    GlobalWikiPage_Markdown = "GlobalWikiPage_Markdown",
    SongHistoryTabDescription = "SongHistoryTabDescription",
    StatsPage_markdown = "StatsPage_markdown",
    Workflow_SelectAssigneesDialogDescription = "Workflow_SelectAssigneesDialogDescription",
    EditEventCustomFieldsPage_markdown = "EditEventCustomFieldsPage_markdown",
    EventEditCustomFieldValuesDialog_TitleMarkdown = "EventEditCustomFieldValuesDialog_TitleMarkdown",
    EventEditCustomFieldValuesDialog_DescriptionMarkdown = "EventEditCustomFieldValuesDialog_DescriptionMarkdown",

    // not markdown....

    // on the backstage home dashboard, which events to display
    BackstageFrontpageEventMaxAgeDays = "BackstageFrontpageEventMaxAgeDays",

    // on the backstage home dashboard, a song is considered "current" if it's at MOST this long since playing it.
    BackstageFrontpageCurrentSongMaxAgeDays = "BackstageFrontpageCurrentSongMaxAgeDays",

    textPalette = "textPalette",
    //EnableOldPublicHomepageBackstageLink = "EnableOldPublicHomepageBackstageLink",
    //EnableNewPublicHomepageBackstageLink = "EnableNewPublicHomepageBackstageLink",

    // for markdown editor drop images
    maxImageDimension = "maxImageDimension",
};

export type SettingKey = keyof typeof Setting;

export interface SetSettingArgs {
    ctx: Ctx,
    setting: Setting | string,
    value?: any,
};

export async function SetSetting(args: SetSettingArgs) {
    const settingName = args.setting as string;
    if (args.value === null || args.value === undefined) {
        const existing = await db.setting.findFirst({ where: { name: settingName, } });
        if (!existing) return;

        await db.setting.deleteMany({ where: { name: settingName, } });

        await RegisterChange({
            action: ChangeAction.delete,
            ctx: args.ctx,
            changeContext: CreateChangeContext("SetSetting"),
            table: "setting",
            pkid: existing.id,
            oldValues: existing,
        });

        return;
    }

    const obj = await db.setting.create({
        data: {
            name: settingName,
            value: JSON.stringify(args.value),
        }
    });

    await RegisterChange({
        action: ChangeAction.delete,
        ctx: args.ctx,
        changeContext: CreateChangeContext("SetSetting"),
        table: "setting",
        pkid: obj.id,
        newValues: obj,
    });
}
