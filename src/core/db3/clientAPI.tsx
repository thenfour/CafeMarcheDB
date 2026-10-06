// re dependency cycle between this & db3clientbasicfields...
// this file NEEDS clientbasicfields because we have tableclients & corresponding columns.
// so it means the clientbasicfields is lower level than this file, which feels wrong but ok.

import { TAnyModel } from "@/shared/rootroot";
import { useSession } from "@blitzjs/auth";
import { MutationFunction, useMutation } from "@blitzjs/rpc";
import * as db3 from "@db3/db3";
import { GridFilterModel, GridSortModel } from "@mui/x-data-grid";
import { shouldShowAdminControls } from "shared/adminControls";
import setShowingAdminControls from "src/auth/mutations/setShowingAdminControls";
import insertEvent from "./mutations/insertEvent";
import updateEventBasicFields from "./mutations/updateEventBasicFields";
import updateGalleryItemImage from "./mutations/updateGalleryItemImage";
import updateSongBasicFields from "./mutations/updateSongBasicFields";
import updateUserEventAttendanceMutation from "./mutations/updateUserEventAttendanceMutation";

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
    maxBpm: number | null;
    // credits?
    // tags?
};

////////////////////////////////////////////////////////////////////////////////////////////////////
class FilesAPI {

    updateGalleryItemImageMutation = CreateAPIMutationFunction(updateGalleryItemImage);

};

const gFilesAPI = new FilesAPI();


////////////////////////////////////////////////////////////////////////////////////////////////////
class EventsAPI {
    getSongListStats = (songList: db3.EventSongListPayload): SongListStats => {
        console.assert(songList.songs);
        const initialValue: SongListStats = {
            durationSeconds: 0,
            songsOfUnknownDuration: 0,
            songCount: 0,
            maxBpm: null,
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
            if (song.song.startBPM != null) {
                ret.maxBpm = ret.maxBpm == null ? song.song.startBPM : Math.max(ret.maxBpm, song.song.startBPM);
            }
            return ret;
        }, initialValue);
    };

    newEventMutation = CreateAPIMutationFunction(insertEvent);

    updateUserEventAttendance = CreateAPIMutationFunction(updateUserEventAttendanceMutation);
    updateEventBasicFields = CreateAPIMutationFunction(updateEventBasicFields);

};

////////////////////////////////////////////////////////////////////////////////////////////////////
class SongsAPI {

    updateSongBasicFields = CreateAPIMutationFunction(updateSongBasicFields);
};


////////////////////////////////////////////////////////////////////////////////////////////////////

class OtherAPI {
    setShowingAdminControlsMutation = CreateAPIMutationFunction(setShowingAdminControls);

    useIsShowingAdminControls() {
        const sess = useSession(); // use existing session. don't call useAuthenticatedSession which will throw if you're not authenticated. we want the ability to just return "no" without killing the user's request
        return shouldShowAdminControls(sess);
    };
};

// class SettingsAPI {

//     useSetting = (settingName: SettingKey) => {
//         const [value, { refetch }] = useQuery(getSetting, { name: settingName }, gQueryOptions.default);
//         return value;
//     }

//     useNumberSetting = (settingName: SettingKey, defaultVal: number) => {
//         const [value, { refetch }] = useQuery(getSetting, { name: settingName }, gQueryOptions.default);
//         return CoerceToNumberOr(value, defaultVal);
//     }

//     useMutableSetting = (settingName: SettingKey): [value: string | null, mutateFn: (args: { name: string, value: string | null }) => Promise<any>] => {
//         const [value, { refetch }] = useQuery(getSetting, { name: settingName }, gQueryOptions.default);
//         const [mutateFn] = useMutation(updateSettingMutation);
//         return [value, mutateFn];
//     }

//     updateSetting = CreateAPIMutationFunction(updateSettingMutation);
// };

// todo: this should be in context
export const API = {
    events: new EventsAPI(),
    songs: new SongsAPI(),
    files: gFilesAPI,
    other: new OtherAPI(),
    //settings: new SettingsAPI(),
};
