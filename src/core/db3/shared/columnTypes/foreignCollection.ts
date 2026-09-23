
import { TAnyModel } from "@/shared/rootroot";
import type { DB3Authorization } from "../db3Authorization";
import {
    ApplyIncludeFilteringToRelation, type DB3FieldPrismaMember,
    type DB3RelationTargetField, type DB3TableTypeRegistry, GetTableById,
} from "../db3core";
import { GhostField, GhostFieldArgs } from "./ghost";


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// A direct child collection, with the same value handling as a GhostField but
// an explicit target schema for authorization and nested relation traversal.
export class ForeignCollectionField<
    const TTargetTableID extends Extract<keyof DB3TableTypeRegistry, string>,
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

    ApplyIncludeFiltering = async (include: TAnyModel, publicData: DB3Authorization, includeDeleted: boolean) => {
        await ApplyIncludeFilteringToRelation(include, this.member, null, this.foreignTableID, publicData, includeDeleted);
    };
}
