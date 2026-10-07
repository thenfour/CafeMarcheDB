import { z } from "zod";
import { markdownStaticString, plainStaticString } from "./staticLocalizedStringRegistryHelpers";
import { freezeRegistry } from "@/src/setting/shared/registryHelpers";
import { instrumentStrings } from "./instrumentStrings";
import { catalogStrings } from "./catalogStrings";
import { membershipStrings } from "./membershipStrings";
import { dashboardStrings } from "./dashboardStrings";

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
    ...instrumentStrings,
    ...catalogStrings,
    ...membershipStrings,
    ...dashboardStrings,
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
    "common.items.count": plainStaticString({
        defaultValue: "{count, plural, one {# item} other {# items}}",
        description: "Number of items in a collection",
        schema: z.string(),
        parameters: [{ key: "count", description: "Item count", type: "number" }],
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

export type StaticLocalizedStringKey = keyof typeof kStaticLocalizedStringRegistry;

type KeysWithFormat<TFormat extends "plain" | "markdown"> = {
    [K in StaticLocalizedStringKey]: typeof kStaticLocalizedStringRegistry[K]["format"] extends TFormat ? K : never;
}[StaticLocalizedStringKey];

export type LocalizedMarkdownKey = KeysWithFormat<"markdown">;
export type LocalizedPlainStringKey = KeysWithFormat<"plain">;

type ParameterValue<T> = T extends "number" ? number : T extends "date" ? Date : string;

export type StaticStringParameters<K extends LocalizedPlainStringKey> =
    typeof kStaticLocalizedStringRegistry[K] extends { readonly parameters: readonly (infer P)[] }
    ? { [Parameter in P as Parameter extends { key: infer Name extends string } ? Name : never]:
        ParameterValue<Parameter extends { type: infer T } ? T : never> }
    : never;

export type StaticStringArguments<K extends LocalizedPlainStringKey> =
    [StaticStringParameters<K>] extends [never] ? [] : [parameters: StaticStringParameters<K>];
