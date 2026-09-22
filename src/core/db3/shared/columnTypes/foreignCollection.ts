
import { TAnyModel } from "@/shared/rootroot";
import type { DB3Authorization } from "../db3Authorization";
import {
    ApplyIncludeFilteringToRelation, type DB3FieldPrismaMember,
    type DB3RelationTargetField, GetTableById, type xTable,
} from "../db3core";
import { GhostField, GhostFieldArgs } from "./ghost";


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// A direct child collection, with the same value handling as a GhostField but
// an explicit target schema for authorization and nested relation traversal.
export class ForeignCollectionField<
    TTargetTable extends xTable = xTable,
> extends GhostField implements DB3RelationTargetField<TTargetTable> {
    declare readonly __relationTargetTable: TTargetTable;
    foreignTableID: string;

    constructor(args: GhostFieldArgs & { foreignTableID: string }) {
        super(args);
        this.foreignTableID = args.foreignTableID;
    }

    getPrismaMemberDescriptors = (): readonly DB3FieldPrismaMember[] => [{
        member: this.member,
        kind: "relationCollection",
        getTargetTable: () => GetTableById(this.foreignTableID),
    }];

    ApplyIncludeFiltering = async (include: TAnyModel, publicData: DB3Authorization, includeDeleted: boolean) => {
        await ApplyIncludeFilteringToRelation(include, this.member, null, this.foreignTableID, publicData, includeDeleted);
    };
}
