// re dependency cycle between this & db3clientbasicfields...
// this file NEEDS clientbasicfields because we have tableclients & corresponding columns.
// so it means the clientbasicfields is lower level than this file, which feels wrong but ok.

import { useSession } from "@blitzjs/auth";
import { MutationFunction, useMutation, useQuery } from "@blitzjs/rpc";
import { GridFilterModel, GridSortModel } from "@mui/x-data-grid";
import { Prisma } from "db";
import { EnNlFr, LangSelectString } from "shared/lang";
import { SettingKey } from "shared/settings";
import { DateTimeRange } from "shared/time";
import { CoerceToNumberOr, gQueryOptions } from "shared/utils";
import setShowingAdminControls from "src/auth/mutations/setShowingAdminControls";
import updateSettingMutation from "src/auth/mutations/updateSetting";
import getSetting from "src/auth/queries/getSetting";
import * as db3 from "src/core/db3/db3";
import * as ClientAPILL from "./clientAPILL";
import deleteEventSongList from "./mutations/deleteEventSongList";
import insertEvent from "./mutations/insertEvent";
import insertEventSongListMutation from "./mutations/insertEventSongListMutation";
import updateEventBasicFields from "./mutations/updateEventBasicFields";
import updateEventCustomFieldValuesMutation from "./mutations/updateEventCustomFieldValuesMutation";
import updateEventSongListMutation from "./mutations/updateEventSongListMutation";
import updateGalleryItemImage from "./mutations/updateGalleryItemImage";
import updateGenericSortOrder from "./mutations/updateGenericSortOrder";
import updateSongBasicFields from "./mutations/updateSongBasicFields";
import updateUserEventAttendanceMutation from "./mutations/updateUserEventAttendanceMutation";
import updateUserPrimaryInstrumentMutation from "./mutations/updateUserPrimaryInstrumentMutation";
import { TAnyModel } from "./shared/apiTypes";

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

    updateGalleryItemImageMutation = CreateAPIMutationFunction(updateGalleryItemImage);

};

const gFilesAPI = new FilesAPI();

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

    updateUserPrimaryInstrument = CreateAPIMutationFunction(updateUserPrimaryInstrumentMutation);
};

const gUsersAPI = new UsersAPI();


////////////////////////////////////////////////////////////////////////////////////////////////////
class EventsAPI {


    // sorts by start date, from newest to latest, NULL = future.
    sortEvents<T extends { startsAt: null | Date }>(events: T[]): T[] {
        const ret = [...events];
        ret.sort((a, b) => {
            if (a.startsAt === null || b.startsAt === null) {
                return a.startsAt === null ? 1 : -1;
            }
            return a.startsAt.valueOf() - b.startsAt.valueOf();
        });

        return ret;
    }

    // null-or-whitespace values in EN will not show the field
    // null-or-whitespace values in NL and FR fallback to english
    getAgendaItem(event: db3.EventWithTagsPayload, lang: EnNlFr): HomepageAgendaItemSpec {
        //const fallbacks = this.getAgendaItemFallbackValues(event, lang);
        const ret: HomepageAgendaItemSpec = {
            date: LangSelectString(lang, event.frontpageDate, event.frontpageDate_nl, event.frontpageDate_fr) || "",
            time: LangSelectString(lang, event.frontpageTime, event.frontpageTime_nl, event.frontpageTime_fr) || "",
            detailsMarkdown: LangSelectString(lang, event.frontpageDetails, event.frontpageDetails_nl, event.frontpageDetails_fr) || "",
            location: LangSelectString(lang, event.frontpageLocation, event.frontpageLocation_nl, event.frontpageLocation_fr) || "",
            locationURI: LangSelectString(lang, event.frontpageLocationURI, event.frontpageLocationURI_nl, event.frontpageLocationURI_fr) || "",
            tags: LangSelectString(lang, event.frontpageTags, event.frontpageTags_nl, event.frontpageTags_fr) || "",
            title: LangSelectString(lang, event.frontpageTitle, event.frontpageTitle_nl, event.frontpageTitle_fr) || "",
        }
        return ret;
    }

    // getAgendaItemFallbackValues(event: db3.EventWithTagsPayload, lang: EnNlFr): HomepageAgendaItemSpec {
    //     const ret: HomepageAgendaItemSpec = {
    //         date: "",
    //         time: "",
    //         detailsMarkdown: "",
    //         location: event.locationDescription,
    //         locationURI: event.locationURL,
    //         tags: event.tags.filter(a => a.eventTag.visibleOnFrontpage).map(a => `#${a.eventTag.text}`).join(" "),
    //         title: event.name,
    //     };
    //     return ret;
    // }

    getEventSegmentFormattedDateRange(segment: Prisma.EventSegmentGetPayload<{ select: { startsAt: true, durationMillis: true, isAllDay: true, } }>) {
        return db3.getEventSegmentDateTimeRange(segment).toString();
        //return "daterangehere";
    }

    getEventDateRange(event: Prisma.EventGetPayload<{ select: { startsAt: true, durationMillis: true, isAllDay: true, } }>) {
        return new DateTimeRange({
            startsAtDateTime: event.startsAt,
            durationMillis: Number(event.durationMillis),
            isAllDay: event.isAllDay,
        });
    }

    // getEventDateRange(event: Prisma.EventGetPayload<{ select: { segments: { select: { startsAt: true, durationMillis: true, isAllDay } } } }>) {
    //     let ret = new DateTimeRange({ startsAtDateTime: null, durationMillis: 0, isAllDay: true });
    //     for (const segment of event.segments) {
    //         const r = db3.getEventSegmentDateTimeRange(segment);
    //         const newRet = ret.unionWith(r);
    //         ret = newRet;
    //     }
    //     return ret;
    // }

    getURIForEvent(event: Prisma.EventGetPayload<{ select: { id: true, name: true } }>, tabSlug?: string) {
        return ClientAPILL.getURIForEvent(event, tabSlug);
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

    updateEventCustomFieldValues = CreateAPIMutationFunction(updateEventCustomFieldValuesMutation);
};

////////////////////////////////////////////////////////////////////////////////////////////////////
class SongsAPI {

    getURIForSong(song: Prisma.SongGetPayload<{ select: { id: true, name: true } }>, tabSlug?: string) {
        return ClientAPILL.getURIForSong(song, tabSlug);
    }

    getFormattedBPM(song: Prisma.SongGetPayload<{ select: { startBPM: true, endBPM: true } }>) {
        return ClientAPILL.getFormattedBPM(song);
    }

    updateSongBasicFields = CreateAPIMutationFunction(updateSongBasicFields);
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
        const sess = useSession(); // use existing session. don't call useAuthenticatedSession which will throw if you're not authenticated. we want the ability to just return "no" without killing the user's request
        return sess.isSysAdmin && sess.showAdminControls;
    };
};

class SettingsAPI {

    useSetting = (settingName: SettingKey) => {
        const [value, { refetch }] = useQuery(getSetting, { name: settingName }, gQueryOptions.default);
        return value;
    }

    useNumberSetting = (settingName: SettingKey, defaultVal: number) => {
        const [value, { refetch }] = useQuery(getSetting, { name: settingName }, gQueryOptions.default);
        return CoerceToNumberOr(value, defaultVal);
    }

    useMutableSetting = (settingName: SettingKey): [value: string | null, mutateFn: (args: { name: string, value: string | null }) => Promise<any>] => {
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
