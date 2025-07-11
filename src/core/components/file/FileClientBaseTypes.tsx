import { SortDirection } from 'shared/rootroot';
import { DiscreteCriterion } from "../../db3/shared/apiTypes";

export enum FileOrderByColumnOptions {
    id = "id",
    uploadedAt = "uploadedAt",
    fileLeafName = "fileLeafName",
    sizeBytes = "sizeBytes",
    mimeType = "mimeType",
}

export type FileOrderByColumnOption = keyof typeof FileOrderByColumnOptions;

export interface FilesFilterSpec {
    refreshSerial: number;
    quickFilter: string;
    orderByColumn: FileOrderByColumnOption;
    orderByDirection: SortDirection;

    // File-specific filters
    //typeFilter: DiscreteCriterion; // MIME types
    tagFilter: DiscreteCriterion; // file tags
    //uploaderFilter: DiscreteCriterion; // uploaded by user
    //sizeFilter: DiscreteCriterion; // file size ranges

    // Association filters
    // taggedUserFilter: DiscreteCriterion;
    // taggedEventFilter: DiscreteCriterion;
    // taggedSongFilter: DiscreteCriterion;
    taggedInstrumentFilter: DiscreteCriterion;
}
