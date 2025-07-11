import * as db3 from "src/core/db3/db3";
import { SortDirection } from "@/shared/rootroot";
import { DiscreteCriterion } from "../../db3/shared/apiTypes";

export enum WikiPageOrderByColumnOptions {
    id = "id",
    slug = "slug",
    createdAt = "createdAt",
    namespace = "namespace",
}

export type WikiPageOrderByColumnOption = keyof typeof WikiPageOrderByColumnOptions;

export interface WikiPagesFilterSpec {
    refreshSerial: number;
    quickFilter: string;
    orderByColumn: WikiPageOrderByColumnOption;
    orderByDirection: SortDirection;

    // Wiki-specific filters
    tagFilter: DiscreteCriterion; // wiki page tags
    namespaceFilter: DiscreteCriterion; // namespace filtering
}

export type EnrichedVerboseWikiPage = db3.WikiPagePayload;
