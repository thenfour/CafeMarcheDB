import { MutationFunction, useMutation, useQuery } from "@blitzjs/rpc";
import { GridFilterModel, GridSortModel } from "@mui/x-data-grid";
import { Prisma } from "db";
import { Permission } from "shared/permissions";
import { DateTimeRange, Timing } from "shared/time";
import { Clamp, TAnyModel, gMinImageDimension, gQueryOptions } from "shared/utils";
import getPopularEventTags from "src/auth/queries/getPopularEventTags";
import * as db3 from "src/core/db3/db3";
import * as DB3ClientFields from './components/DB3ClientBasicFields';
import * as DB3ClientCore from './components/DB3ClientCore';
import deleteEventSongList from "./mutations/deleteEventSongList";
import insertEvent from "./mutations/insertEvent";
import insertEventSongListMutation from "./mutations/insertEventSongListMutation";
import updateEventBasicFields from "./mutations/updateEventBasicFields";
import updateEventSongListMutation from "./mutations/updateEventSongListMutation";
import updateGalleryItemImage from "./mutations/updateGalleryItemImage";
import updateGenericSortOrder from "./mutations/updateGenericSortOrder";
import updateUserPrimaryInstrumentMutation from "./mutations/updateUserPrimaryInstrumentMutation";
import { AddCoord2DSize, Coord2D, ImageEditParams, Size, getFileCustomData } from "./shared/apiTypes";
import { ClientSession, useAuthenticatedSession } from "@blitzjs/auth";
import { GetStyleVariablesForColor } from "../components/Color";
import { ColorVariationSpec, gAppColors } from "shared/color";
import getSetting from "src/auth/queries/getSetting";
import updateSettingMutation from "src/auth/mutations/updateSetting";
import updateUserEventAttendanceMutation from "./mutations/updateUserEventAttendanceMutation";
import setShowingAdminControls from "src/auth/mutations/setShowingAdminControls";

////////////////////////////////////////////////////////////////////////////////////////////////////
export interface APIQueryArgs {
    filterModel?: GridFilterModel,
    tableParams?: TAnyModel,
    sortModel?: GridSortModel,
};

export interface APIQueryResult<TClientPayload> {
    items: TClientPayload[],
    refetch: () => void,
};

interface APIMutationToken<TArgs, TReturn> {
    mutateFn: (inp: TArgs) => Promise<TReturn>; // black box
    invoke: (args: TArgs) => Promise<TReturn>; // for clients to invoke the mutation (alias of APIMutationFunction.invoke)
};

class APIMutationFunction<TArgs, TReturn> {
    mutation: MutationFunction<TReturn, TArgs>;

    constructor(mutation: MutationFunction<TReturn, TArgs>) {
        this.mutation = mutation;
    }

    useToken() {
        const [mutateFn] = useMutation(this.mutation);
        const ret: APIMutationToken<TArgs, TReturn> = {
            mutateFn,
            invoke: async (args: TArgs) => {
                return await mutateFn(args);
            }
        };
        return ret;
    }

    async invoke(token: APIMutationToken<TArgs, TReturn>, args: TArgs): Promise<TReturn> {
        return await token.mutateFn(args);
    }
};

// helps deduce types
function CreateAPIMutationFunction<TArgs, TReturn>(mutation: MutationFunction<TReturn, TArgs>) {
    return new APIMutationFunction<TArgs, TReturn>(mutation);
}

export interface EventMinMaxAttendeesResult {
    minAttendees: number | null;
    maxAttendees: number | null;
}

export interface SongListStats {
    songCount: number;
    durationSeconds: number;
    songsOfUnknownDuration: number; // true if the duration excludes songs which have unknown duration
    // credits?
    // tags?
};

////////////////////////////////////////////////////////////////////////////////////////////////////
class FilesAPI {
    getURIForFile = (file: Prisma.FileGetPayload<{}>) => {
        return `/api/files/download/${file.storedLeafName}`;
    }

    getImageFileDimensions = (file: db3.FilePayloadMinimum): Size => {
        const customData = getFileCustomData(file);
        if (customData.imageMetadata?.height != null && customData.imageMetadata?.width != null) {
            return {
                width: customData.imageMetadata!.width!,
                height: customData.imageMetadata!.height!,
            };
        }
        return { width: gMinImageDimension, height: gMinImageDimension };
    };

    // if editParams is omitted, use the ones embedded in the post.
    // using FrontpageGalleryItemPayloadWithAncestorFile because it has looser requirements than others
    getGalleryItemImageInfo = (post: db3.FrontpageGalleryItemPayloadWithAncestorFile, editParams?: ImageEditParams) => {
        const imageURI = API.files.getURIForFile(post.file);
        const fileDimensions = API.files.getImageFileDimensions(post.file)

        const displayParams = editParams || db3.getGalleryItemDisplayParams(post);

        const cropBegin: Coord2D = { ...displayParams.cropBegin };

        const cropSize: Size = displayParams.cropSize ? { ...displayParams.cropSize } : { ...fileDimensions };
        // crop size needs to be adjusted if we clamped cropbegin.
        if (cropBegin.x < 0) {
            cropSize.width += displayParams.cropBegin.x;
            cropBegin.x = 0;
        }
        if (cropBegin.y < 0) {
            cropSize.height += displayParams.cropBegin.y;
            cropBegin.y = 0;
        }
        const cropMax: Coord2D = {
            x: fileDimensions.width - gMinImageDimension,
            y: fileDimensions.height - gMinImageDimension,
        }
        if (cropBegin.x > cropMax.x) {
            cropSize.width -= cropMax.x - cropBegin.x;
            cropBegin.x = cropMax.x;
        }
        if (cropBegin.y > cropMax.y) {
            cropSize.height -= cropMax.y - cropBegin.y;
            cropBegin.y = cropMax.y;
        }

        // if the cropsize would put cropend beyond the image, clamp it.
        cropSize.width = Clamp(cropSize.width, gMinImageDimension, fileDimensions.width - cropBegin.x);
        cropSize.height = Clamp(cropSize.height, gMinImageDimension, fileDimensions.height - cropBegin.y);
        const cropEnd = AddCoord2DSize(cropBegin, cropSize);
        const cropCenter: Coord2D = {
            x: (cropBegin.x + cropEnd.x) / 2,
            y: (cropBegin.y + cropEnd.y) / 2,
        };

        const rotate = displayParams.rotate;

        const maskTopHeight = cropBegin.y;
        const maskBottomHeight = fileDimensions.height - cropEnd.y;
        const maskRightWidth = fileDimensions.width - cropEnd.x;
        const maskLeftWidth = cropBegin.x;

        return {
            imageURI,
            fileDimensions, // raw
            displayParams, // raw from db
            cropBegin, // clamped / sanitized
            cropEnd,// clamped / sanitized
            cropCenter,// clamped / sanitized
            cropSize,// coalesced / clamped / sanitized
            rotate,
            maskTopHeight, // some precalcs for mask display
            maskBottomHeight,
            maskRightWidth,
            maskLeftWidth,
        };
    };

    updateGalleryItemImageMutation = CreateAPIMutationFunction(updateGalleryItemImage);

};

const gFilesAPI = new FilesAPI();

interface ObjectWithVisiblePermission {
    visiblePermissionId: number | null;
    visiblePermission: db3.PermissionPayloadMinimum | null;
};

////////////////////////////////////////////////////////////////////////////////////////////////////
class UsersAPI {
    // returns an instrument payload, or null if the user has no instruments.
    // primary instrument is defined as either teh 1st instrument marked as primary, or if none are primary, the 1st instrument period.
    getPrimaryInstrument = (user: db3.UserPayload): (db3.InstrumentPayload | null) => {
        if (user.instruments.length < 1) return null;
        const p = user.instruments.find(i => i.isPrimary);
        if (p) {
            return p.instrument;
        }
        return user.instruments[0]!.instrument;
    };

    getAllPermissions = () => {
        return DB3ClientCore.useTableRenderContext({
            tableSpec: new DB3ClientCore.xTableClientSpec({
                table: db3.xPermission,
                columns: [
                    new DB3ClientFields.PKColumnClient({ columnName: "id" }),
                ],
            }),
            requestedCaps: DB3ClientCore.xTableClientCaps.Query,
            clientIntention: { intention: 'user', mode: 'primary' },
        });

    };

    getPermission = (q: Permission) => {
        return (this.getAllPermissions().items as Prisma.PermissionGetPayload<{}>[]).find(p => p.name === q);
    };

    getDefaultVisibilityPermission = () => {
        return this.getPermission(Permission.visibility_members)!;
    };

    // useSession -> this
    isAuthorizedFor = (session: ClientSession | null | undefined, q: Permission) => {
        // public
        if (!session || !session.permissions) return q === Permission.visibility_public;
        if (session.isSysAdmin) return true;
        return session.permissions.some(v => v === q);
    };

    getVisibilityInfo = <T extends ObjectWithVisiblePermission,>(item: T) => {
        const visPerm = item.visiblePermission;
        const publicPerms = [
            Permission.visibility_public,
        ];
        const userPerms = [
            Permission.visibility_members,
            Permission.visibility_logged_in_users
        ];
        const editorPerms = [
            Permission.visibility_editors,
        ];
        const isPrivate = visPerm === null; //
        const isForEditors = editorPerms.find(p => visPerm?.name === p);
        const isForUsers = userPerms.find(p => visPerm?.name === p);
        const isPublic = publicPerms.find(p => visPerm?.name === p);
        const cssClasses: string[] = [];
        if (isPrivate) cssClasses.push(`visibility-private`);
        if (isPublic) cssClasses.push(`visibility-public visiblePermission-${visPerm!.name}`);
        if (isForEditors) cssClasses.push(`visibility-editors visiblePermission-${visPerm!.name}`);
        if (isForUsers) cssClasses.push(`visibility-users visiblePermission-${visPerm!.name}`);

        let colorId = visPerm?.color;
        if (colorId == null) {
            colorId = gAppColors.private_visibility;
        }

        //const style = GetStyleVariablesForColor(colorId);

        return {
            isPrivate,
            isPublic,
            isForEditors,
            isForUsers,
            //style,
            colorId,
            getStyleVariablesForColor: (variation: ColorVariationSpec) => GetStyleVariablesForColor({ color: colorId, ...variation }),
            className: cssClasses.join(" "),
        }
    }

    isPublic = <T extends ObjectWithVisiblePermission,>(item: T) => {
        return this.getVisibilityInfo(item).isPublic;
    };

    getUserTagsClient() {
        return DB3ClientCore.useTableRenderContext({
            tableSpec: new DB3ClientCore.xTableClientSpec({
                table: db3.xUserTag,
                columns: [
                    new DB3ClientFields.PKColumnClient({ columnName: "id" }),
                ],
            }),
            requestedCaps: DB3ClientCore.xTableClientCaps.Query,
            clientIntention: { intention: 'user', mode: 'primary' },
        });
    }

    getUserTag(userTagId: number | null): null | db3.UserTagPayload {
        if (!userTagId) return null;
        const ctx = DB3ClientCore.useTableRenderContext({
            requestedCaps: DB3ClientCore.xTableClientCaps.Query,
            clientIntention: { intention: 'user', mode: 'primary' },
            tableSpec: new DB3ClientCore.xTableClientSpec({
                table: db3.xUserTag,
                columns: [
                    new DB3ClientFields.PKColumnClient({ columnName: "id" }),
                ],
            }),
            filterModel: {
                items: [],
                tableParams: {
                    userTagId,
                }
            },
        });
        return (ctx.items?.length === 1 ? ctx.items[0] : null) as any;
    }


    updateUserPrimaryInstrument = CreateAPIMutationFunction(updateUserPrimaryInstrumentMutation);
};

const gUsersAPI = new UsersAPI();


////////////////////////////////////////////////////////////////////////////////////////////////////
class EventsAPI {

    getAgendaItem(event: db3.EventWithTagsPayload): HomepageAgendaItemSpec {
        const fallbacks = this.getAgendaItemFallbackValues(event);
        const ret: HomepageAgendaItemSpec = {
            date: event.frontpageDate || fallbacks.date || "",
            time: event.frontpageTime || fallbacks.time || "",
            detailsMarkdown: event.frontpageDetails || fallbacks.detailsMarkdown || "",
            location: event.frontpageLocation || fallbacks.location || "",
            locationURI: event.frontpageLocationURI || fallbacks.locationURI || "",
            tags: event.frontpageTags || fallbacks.tags || "",
            title: event.frontpageTitle || fallbacks.title || "",
        }
        return ret;
    }

    getAgendaItemFallbackValues(event: db3.EventWithTagsPayload): HomepageAgendaItemSpec {
        const ret: HomepageAgendaItemSpec = {
            date: "",
            time: "",
            detailsMarkdown: "",
            location: event.locationDescription,
            locationURI: event.locationURL,
            tags: event.tags.filter(a => a.eventTag.visibleOnFrontpage).map(a => `#${a.eventTag.text}`).join(" "),
            title: event.name,
        };
        return ret;
    }

    getEventSegmentFormattedDateRange(segment: db3.EventSegmentPayload) {
        return db3.getEventSegmentDateTimeRange(segment).toString();
        //return "daterangehere";
    }

    getEventDateRange(event: db3.EventClientPayload_Verbose) {
        let ret = new DateTimeRange({ startsAtDateTime: null, durationMillis: 0, isAllDay: true });
        //console.log(`---------- begin getEventDateRange`);
        for (const segment of event.segments) {
            const r = db3.getEventSegmentDateTimeRange(segment);
            const newRet = ret.unionWith(r);
            //console.log(`  union: ${ret.toString()} + ${r.toString()} = ${newRet.toString()}`);
            ret = newRet;
        }
        //console.log(`---------- end getEventDateRange: ${ret.toString()}`);
        return ret;
    }

    getEventTiming(event: db3.EventClientPayload_Verbose) {
        const r = this.getEventDateRange(event);
        return r.hitTestDateTime();
    }

    // getEventInfoForUser(args: { event: db3.EventClientPayload_Verbose, user: db3.UserWithInstrumentsPayload }) {
    //     const i = new db3.EventInfoForUser({ event: args.event, user: args.user });
    //     return i;
    // }

    getURIForEvent(eventOrEventIdOrSlug: number | string | db3.EventPayloadMinimum, tabSlug?: string) {
        const tabPart = tabSlug ? `/${tabSlug}` : "";

        if (typeof eventOrEventIdOrSlug === 'object') {
            if (eventOrEventIdOrSlug.slug) {
                return `/backstage/event/${eventOrEventIdOrSlug.slug}${tabPart}`;
            }
        }
        return `/backstage/event/${eventOrEventIdOrSlug}${tabPart}`;
    }

    getMinMaxAttendees({ event }: { event: db3.EventClientPayload_Verbose }) {
        const ret: EventMinMaxAttendeesResult = {
            minAttendees: null,
            maxAttendees: null,
        };
        event.segments.forEach(seg => {
            // count attendees for this segment who are going
            const att = seg.responses.filter(resp => resp.attendance && (resp.attendance.strength > 50)).length;
            if (ret.minAttendees === null || att < ret.minAttendees) ret.minAttendees = att;
            if (ret.maxAttendees === null || att > ret.maxAttendees) ret.maxAttendees = att;
        });
        return ret;
    }

    // returns an array, one element per segment, containing # of people attending.
    getAttendeeCountPerSegment({ event }: { event: db3.EventClientPayload_Verbose }) {
        return event.segments.map(seg => ({
            segment: seg,
            attendeeCount: seg.responses.filter(resp => resp.attendance && (resp.attendance.strength > 50)).length
        }));
    }

    getEventTypesClient() {
        return DB3ClientCore.useTableRenderContext({
            tableSpec: new DB3ClientCore.xTableClientSpec({
                table: db3.xEventType,
                columns: [
                    new DB3ClientFields.PKColumnClient({ columnName: "id" }),
                ],
            }),
            requestedCaps: DB3ClientCore.xTableClientCaps.Query,
            clientIntention: { intention: 'user', mode: 'primary' },
        });
    }

    getEventStatusesClient() {
        return DB3ClientCore.useTableRenderContext({
            tableSpec: new DB3ClientCore.xTableClientSpec({
                table: db3.xEventStatus,
                columns: [
                    new DB3ClientFields.PKColumnClient({ columnName: "id" }),
                ],
            }),
            requestedCaps: DB3ClientCore.xTableClientCaps.Query,
            clientIntention: { intention: 'user', mode: 'primary' },
        });
    }

    usePopularEventTagsQuery = () => {
        return useQuery(getPopularEventTags, {}, gQueryOptions.default);
    };

    getInstrumentForUserResponse = (response: db3.EventUserResponsePayload, user: db3.UserWithInstrumentsPayload): (db3.InstrumentPayload | null) => {
        return db3.getInstrumentForEventUserResponse(response, user);
    }

    getSongListStats = (songList: db3.EventSongListPayload): SongListStats => {
        console.assert(songList.songs);
        const initialValue: SongListStats = {
            durationSeconds: 0,
            songsOfUnknownDuration: 0,
            songCount: 0,
        };
        // filter out "new" items which have no song specified yet.
        return songList.songs.filter(s => !!s.songId).reduce((acc, song) => {
            console.assert(!!song.song); // make sure the payload contains
            const ret = acc;
            if (song.song.lengthSeconds == null) {
                ret.songsOfUnknownDuration++;
            } else {
                ret.durationSeconds += song.song.lengthSeconds;
            }
            ret.songCount++;
            return ret;
        }, initialValue);
    };

    newEventMutation = CreateAPIMutationFunction(insertEvent);

    updateUserEventAttendance = CreateAPIMutationFunction(updateUserEventAttendanceMutation);
    updateEventBasicFields = CreateAPIMutationFunction(updateEventBasicFields);

    // lol consistent naming
    insertEventSongListx = CreateAPIMutationFunction(insertEventSongListMutation);
    deleteEventSongListx = CreateAPIMutationFunction(deleteEventSongList);
    updateEventSongListx = CreateAPIMutationFunction(updateEventSongListMutation);
};

////////////////////////////////////////////////////////////////////////////////////////////////////
class SongsAPI {

    getURIForSong(songOrIdOrSlug: number | string | db3.SongPayloadMinimum) {
        if (typeof songOrIdOrSlug === 'object') {
            if (songOrIdOrSlug.slug) {
                return `/backstage/song/${songOrIdOrSlug.slug}`;
            }
        }
        return `/backstage/song/${songOrIdOrSlug}`;
    }

    getFormattedBPM(song: db3.SongPayloadMinimum) {
        if (!song.startBPM) {
            if (!song.endBPM) {
                return "";// neither specified
            }
            return `⇢${song.endBPM}`; // only end bpm
        }
        if (!song.endBPM) {
            return `${song.startBPM}⇢`; // only start bpm
        }
        // both specified 
        if ((song.startBPM | 0) === (song.endBPM | 0)) {
            return `${song.startBPM}`; // both BPMs the same: just show 1.
        }
        return `${song.startBPM}⇢${song.endBPM}`; // only start bpm
    }

};


////////////////////////////////////////////////////////////////////////////////////////////////////
// export interface HomepageGalleryItemSpec {
//     descriptionMarkdown: string;
//     uri: string;
// };
export interface HomepageAgendaItemSpec {
    date?: string | null;
    time?: string | null;
    title?: string | null;
    detailsMarkdown?: string | null;
    location?: string | null;
    locationURI?: string | null;
    tags?: string | null;
};
export interface HomepageContentSpec {
    agenda: HomepageAgendaItemSpec[];
    gallery: db3.FrontpageGalleryItemPayloadWithAncestorFile[];
};



class FrontpageAPI {

};

class OtherAPI {
    updateGenericSortOrderMutation = CreateAPIMutationFunction(updateGenericSortOrder);
    setShowingAdminControlsMutation = CreateAPIMutationFunction(setShowingAdminControls);

    useIsShowingAdminControls() {
        const sess = useAuthenticatedSession();
        return sess.isSysAdmin && sess.showAdminControls;
    };
};

class SettingsAPI {

    useSetting = (settingName: string) => {
        const [value, { refetch }] = useQuery(getSetting, { name: settingName }, gQueryOptions.default);
        return value;
    }

    useMutableSetting = (settingName: string): [value: string | null, mutateFn: (args: { name: string, value: string | null }) => Promise<any>] => {
        const [value, { refetch }] = useQuery(getSetting, { name: settingName }, gQueryOptions.default);
        const [mutateFn] = useMutation(updateSettingMutation);
        return [value, mutateFn];
    }

    updateSetting = CreateAPIMutationFunction(updateSettingMutation);
};


export const API = {
    events: new EventsAPI(),
    songs: new SongsAPI(),
    frontpage: new FrontpageAPI(),
    users: gUsersAPI,
    files: gFilesAPI,
    other: new OtherAPI(),
    settings: new SettingsAPI(),
};
