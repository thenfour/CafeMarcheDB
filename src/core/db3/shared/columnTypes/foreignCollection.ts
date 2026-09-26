
import { TAnyModel } from "@/shared/rootroot";
import type { DB3ServerAuthorization } from "src/core/db3/server/db3ServerAuthorization";
import {
    ApplyIncludeFilteringToRelation, type DB3FieldPrismaMember,
    type DB3RegisteredTableID, type DB3RelationTargetField, GetTableById,
} from "../db3core";
import { GhostField, GhostFieldArgs } from "./ghost";


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// A direct child collection, with the same value handling as a GhostField but
// an explicit target schema for authorization and nested relation traversal.
export class ForeignCollectionField<
    const TTargetTableID extends DB3RegisteredTableID,
> extends GhostField implements DB3RelationTargetField<TTargetTableID> {
    declare readonly __relationTargetTable: TTargetTableID;
    foreignTableID: TTargetTableID;

    constructor(args: GhostFieldArgs & { foreignTableID: TTargetTableID }) {
        super(args);
        this.foreignTableID = args.foreignTableID;
    }

    getPrismaMemberDescriptors = (): readonly DB3FieldPrismaMember[] => [{
        member: this.member,
        kind: "relationCollection",
        getTargetTable: () => GetTableById(this.foreignTableID),
    }];

    ApplyIncludeFiltering = async (include: TAnyModel, publicData: DB3ServerAuthorization, includeDeleted: boolean) => {
        await ApplyIncludeFilteringToRelation(include, this.member, null, this.foreignTableID, publicData, includeDeleted);
    };
}
