
// TO LOCALIZED STRING ---------------------------------------------
// - menuLink.visiblePermission.DescriptionMarkdown
// - event.visiblePermission.DescriptionMarkdown
// - Song.visiblePermission.DescriptionMarkdown
// - File.visiblePermission.DescriptionMarkdown

// - RolesAdminPage_markdown
// - EditUserTagsPage_markdown
// - editSongTags_markdown
// - InstrumentFunctionalGroupList_markdown
// - instrumentList_markdown
// - DashboardStats_SongsMarkdown
// - customLink.redirectType.DescriptionMarkdown
// - CustomLinksPageMarkdown
// - MenuLinksPageMarkdown
// - menuLink.groupName.DescriptionMarkdown
// - menuLink.caption.DescriptionMarkdown
// - menuLink.iconName.DescriptionMarkdown
// - menuLink.linkType.DescriptionMarkdown
// - menuLink.externalURI.DescriptionMarkdown
// - menuLink.wikiSlug.DescriptionMarkdown
// - menuLink.groupCssClass.DescriptionMarkdown
// - menuLink.itemCssClass.DescriptionMarkdown

// - EditEventTagsPage_markdown
// - EventSegment.description.DescriptionMarkdown
// - Event.workflowDef.DescriptionMarkdown
// - NewEventSegmentDialogDescription
// - NewEventSegmentDialogTitle

import { z } from "zod";
import { markdownStaticString, plainStaticString } from "./staticLocalizedStringRegistryHelpers";
import { freezeRegistry } from "@/src/setting/shared/registryHelpers";

//     // // mostly pages or sections of pages...
//     // HomeDescription = "HomeDescription",
//     // event_description_mockup_markdown = "event_description_mockup_markdown",
//     // EditEventAttendancesPage_markdown = "EditEventAttendancesPage_markdown",
//     // editEvents_markdown = "editEvents_markdown",
//     // EditEventSegmentsPage_markdown = "EditEventSegmentsPage_markdown",
//     // EventSegmentUserResponsePage_markdown = "EventSegmentUserResponsePage_markdown",
//     // EditEventSongListsPage_markdown = "EditEventSongListsPage_markdown",
//     // EditEventSongListSongsPage_markdown = "EditEventSongListSongsPage_markdown",
//     // EditEventStatusesPage_markdown = "EditEventStatusesPage_markdown",
//     // EditEventTagsPage_markdown = "EditEventTagsPage_markdown",
//     // EditEventTypesPage_markdown = "EditEventTypesPage_markdown",
//     // EventUserResponsePage_markdown = "EventUserResponsePage_markdown",
//     // EditFilesPage_markdown = "EditFilesPage_markdown",
//     // EditFileTagsPage_markdown = "EditFileTagsPage_markdown",
//     // EditFrontpageGalleryItemsPage_markdown = "EditFrontpageGalleryItemsPage_markdown",
//     // EditSongCreditsPage_markdown = "EditSongCreditsPage_markdown",
//     // editSongCreditTypes_markdown = "editSongCreditTypes_markdown",
//     // editSongs_markdown = "editSongs_markdown",
//     // editSongTags_markdown = "editSongTags_markdown",
//     // editWikiPageTags_markdown = "editWikiPageTags_markdown",
//     // EditUserTagsPage_markdown = "EditUserTagsPage_markdown",
//     // events_markdown = "events_markdown",
//     // frontpage_gallery_markdown = "frontpage_gallery_markdown",
//     // files_markdown = "files_markdown",
//     // info_text = "info_text",
//     // InstrumentFunctionalGroupList_markdown = "InstrumentFunctionalGroupList_markdown",
//     // instrumentList_markdown = "instrumentList_markdown",
//     // profile_markdown = "profile_markdown",
//     // rolePermissionsMatrixPage_markdown = "rolePermissionsMatrixPage_markdown",
//     // RolesAdminPage_markdown = "RolesAdminPage_markdown",
//     // settings_markdown = "settings_markdown",
//     // songs_markdown = "songs_markdown",
//     // usersearch_markdown = "usersearch_markdown",
//     // AdminLogsPage_markdown = "AdminLogsPage_markdown",
//     // UserInstrumentsPage_markdown = "UserInstrumentsPage_markdown",
//     // EventSongListTabDescription = "EventSongListTabDescription",
//     // EventAttendanceDetailMarkdown = "EventAttendanceDetailMarkdown",
//     // EventCompletenessTabMarkdown = "EventCompletenessTabMarkdown",
//     // FrontpageAgendaPage_markdown = "FrontpageAgendaPage_markdown",
//     // BackstageFrontpageMarkdown = "BackstageFrontpageMarkdown",
//     // BackstageFrontpageHeaderMarkdown = "BackstageFrontpageHeaderMarkdown",
//     // DashboardStats_SongsMarkdown = "DashboardStats_SongsMarkdown",
//     // DashboardStats_EventsMarkdown = "DashboardStats_EventsMarkdown",
//     // CustomLinksPageMarkdown = "CustomLinksPageMarkdown",
//     // MenuLinksPageMarkdown = "MenuLinksPageMarkdown",
//     // GlobalWikiPage_Markdown = "GlobalWikiPage_Markdown",
//     // SongHistoryTabDescription = "SongHistoryTabDescription",
//     // StatsPage_markdown = "StatsPage_markdown",
//     // profile_description_markdown = "profile_description_markdown",
//     // EditFileDialogDescription = "EditFileDialogDescription",
//     // QrCodeForThisPageDescriptionMarkdown = "QrCodeForThisPageDescriptionMarkdown",

function defaultMarkdownStaticString() {
    return markdownStaticString({
        defaultValue: "",
        description: "",
        schema: z.string(),
    });
}

function defaultPlainStringStaticString() {
    return plainStaticString({
        defaultValue: "",
        description: "",
        schema: z.string(),
    });
}

export const kStaticLocalizedStringRegistry = freezeRegistry({
    "common.action.ok": plainStaticString({
        defaultValue: "OK",
        description: "Label for an OK button",
        schema: z.string(),
    }),
    "common.action.cancel": plainStaticString({
        defaultValue: "Cancel",
        description: "Label for a Cancel button",
        schema: z.string(),
    }),
    // TODO: find better names, fill in defaults & descriptions, use correct types, parameters...
    "InstrumentFunctionalGroupList_markdown": defaultMarkdownStaticString(),
    "instrumentList_markdown": defaultMarkdownStaticString(),
    "MenuLinksPageMarkdown": defaultMarkdownStaticString(),
    "profile_markdown": defaultMarkdownStaticString(),
    "profile_description_markdown": defaultMarkdownStaticString(),
    "rolePermissionsMatrixPage_markdown": defaultMarkdownStaticString(),
    "RolesAdminPage_markdown": defaultMarkdownStaticString(),
    "HomeDescription": defaultMarkdownStaticString(),
    "event_description_mockup_markdown": defaultMarkdownStaticString(),
    "EditEventAttendancesPage_markdown": defaultMarkdownStaticString(),
    "editEvents_markdown": defaultMarkdownStaticString(),
    "EditEventSegmentsPage_markdown": defaultMarkdownStaticString(),
    "EventSegmentUserResponsePage_markdown": defaultMarkdownStaticString(),
    "EditEventSongListsPage_markdown": defaultMarkdownStaticString(),
    "EditEventSongListSongsPage_markdown": defaultMarkdownStaticString(),
    "EditEventStatusesPage_markdown": defaultMarkdownStaticString(),
    "EditEventTagsPage_markdown": defaultMarkdownStaticString(),
    "EditEventTypesPage_markdown": defaultMarkdownStaticString(),
    "EventUserResponsePage_markdown": defaultMarkdownStaticString(),
    "EditFilesPage_markdown": defaultMarkdownStaticString(),
    "EditFileTagsPage_markdown": defaultMarkdownStaticString(),
    "EditFrontpageGalleryItemsPage_markdown": defaultMarkdownStaticString(),
    "EditSongCreditsPage_markdown": defaultMarkdownStaticString(),
    "editSongCreditTypes_markdown": defaultMarkdownStaticString(),
    "editSongs_markdown": defaultMarkdownStaticString(),
    "editSongTags_markdown": defaultMarkdownStaticString(),
    "editWikiPageTags_markdown": defaultMarkdownStaticString(),
    "EditUserTagsPage_markdown": defaultMarkdownStaticString(),
    "events_markdown": defaultMarkdownStaticString(),
    "frontpage_gallery_markdown": defaultMarkdownStaticString(),
    "files_markdown": defaultMarkdownStaticString(),
    "settings_markdown": defaultMarkdownStaticString(),
    "songs_markdown": defaultMarkdownStaticString(),
    "usersearch_markdown": defaultMarkdownStaticString(),
    "AdminLogsPage_markdown": defaultMarkdownStaticString(),
    "UserInstrumentsPage_markdown": defaultMarkdownStaticString(),
    "EventSongListTabDescription": defaultMarkdownStaticString(),
    "EventAttendanceDetailMarkdown": defaultMarkdownStaticString(),
    "EventCompletenessTabMarkdown": defaultMarkdownStaticString(),
    "FrontpageAgendaPage_markdown": defaultMarkdownStaticString(),
    "BackstageFrontpageMarkdown": defaultMarkdownStaticString(),
    "BackstageFrontpageHeaderMarkdown": defaultMarkdownStaticString(),
    "DashboardStats_SongsMarkdown": defaultMarkdownStaticString(),
    "DashboardStats_EventsMarkdown": defaultMarkdownStaticString(),
    "CustomLinksPageMarkdown": defaultMarkdownStaticString(),
    "GlobalWikiPage_Markdown": defaultMarkdownStaticString(),
    "SongHistoryTabDescription": defaultMarkdownStaticString(),
    "StatsPage_markdown": defaultMarkdownStaticString(),
    "EditFileDialogDescription": defaultMarkdownStaticString(),
    "QrCodeForThisPageDescriptionMarkdown": defaultMarkdownStaticString(),
    "event.expectedAttendanceUserTag.DescriptionMarkdown": defaultMarkdownStaticString(),
    "EditEventDialogDescriptionMarkdown": defaultMarkdownStaticString(),
    "EventAttendanceEditDialog_TitleMarkdown": defaultMarkdownStaticString(),
    "EventAttendanceEditDialog_DescriptionMarkdown": defaultMarkdownStaticString(),
    "EventInviteUsersDialogDescriptionMarkdown": defaultMarkdownStaticString(),
    "NewEventDialogDescriptionMarkdown": defaultMarkdownStaticString(),
    "EventAttendanceCommentDialog_TitleMarkdown": defaultMarkdownStaticString(),
    "EventAttendanceCommentDialog_DescriptionMarkdown": defaultMarkdownStaticString(),
    "EditEventSongListDialogTitle": defaultMarkdownStaticString(),
    "EditEventSongListDialogDescription": defaultMarkdownStaticString(),
    "EditSongDialogDescription": defaultMarkdownStaticString(),
    "VisibilityControlSelectDialogDescription": defaultMarkdownStaticString(),
    // Production settings migrated to the Cafe Marche band's en-US overrides.
    "menuLink.visiblePermission.DescriptionMarkdown": defaultMarkdownStaticString(),
    "event.visiblePermission.DescriptionMarkdown": defaultMarkdownStaticString(),
    "Song.visiblePermission.DescriptionMarkdown": defaultMarkdownStaticString(),
    "File.visiblePermission.DescriptionMarkdown": defaultMarkdownStaticString(),
    "customLink.redirectType.DescriptionMarkdown": defaultMarkdownStaticString(),
    "menuLink.groupName.DescriptionMarkdown": defaultMarkdownStaticString(),
    "menuLink.caption.DescriptionMarkdown": defaultMarkdownStaticString(),
    "menuLink.iconName.DescriptionMarkdown": defaultMarkdownStaticString(),
    "menuLink.linkType.DescriptionMarkdown": defaultMarkdownStaticString(),
    "menuLink.externalURI.DescriptionMarkdown": defaultMarkdownStaticString(),
    "menuLink.wikiSlug.DescriptionMarkdown": defaultMarkdownStaticString(),
    "menuLink.groupCssClass.DescriptionMarkdown": defaultMarkdownStaticString(),
    "menuLink.itemCssClass.DescriptionMarkdown": defaultMarkdownStaticString(),
    "EventSegment.description.DescriptionMarkdown": defaultMarkdownStaticString(),
    "Event.workflowDef.DescriptionMarkdown": defaultMarkdownStaticString(),
    "NewEventSegmentDialogDescription": defaultMarkdownStaticString(),
    "NewEventSegmentDialogTitle": defaultMarkdownStaticString(),
    "general.fieldCaptions.id": defaultPlainStringStaticString(),
});

// const c = kStaticLocalizedStringRegistry["common.action.cancel"];

export type StaticLocalizedStringKey = keyof typeof kStaticLocalizedStringRegistry;
export type LocalizedMarkdownKey = keyof typeof kStaticLocalizedStringRegistry; // todo: filtered by markdown
export type LocalizedPlainStringKey = keyof typeof kStaticLocalizedStringRegistry; // todo: filtered by plain strings
