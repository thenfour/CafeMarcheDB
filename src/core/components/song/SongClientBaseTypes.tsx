import { SortDirection } from "@/shared/rootroot";
import { DiscreteCriterion } from "../../db3/shared/apiTypes";

// //////////////////////////////////////////////////////////////////////////////////////////////////
export enum SongOrderByColumnOptions {
    id = "id",
    name = "name",
    startBPM = "startBPM",
};

export type SongOrderByColumnOption = keyof typeof SongOrderByColumnOptions;

export interface SongsFilterSpec {
    quickFilter: string;
    refreshSerial: number; // this is necessary because you can do things to change the results from this page. think of adding an event then refetching.

    orderByColumn: SongOrderByColumnOption;
    orderByDirection: SortDirection;

    tagFilter: DiscreteCriterion;
};


