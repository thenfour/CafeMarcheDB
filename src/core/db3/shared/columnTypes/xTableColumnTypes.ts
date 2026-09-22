// barrel-ish

import { TAnyModel } from "@/shared/rootroot";
import {
    xTable
} from "../db3core";
import { ForeignSingleField } from "./foreignSingle";

export * from "./boolean";
export * from "./color";
export * from "./createdAt";
export * from "./dateTime";
export * from "./enum";
export * from "./eventStartsAt";
export * from "./foreignCollection";
export * from "./foreignSingle";
export * from "./genericInteger";
export * from "./genericString";
export * from "./ghost";
export * from "./pk";
export * from "./publicId";
export * from "./revision";
export * from "./tags";


export interface separateMutationValuesArgs {
    table: xTable;
    fields: TAnyModel;
};
export interface separateMutationValuesResult {
    associationFields: TAnyModel;
    localFields: TAnyModel;
};
export const separateMutationValues = ({ table, fields }: separateMutationValuesArgs) => {
    const ret: separateMutationValuesResult = {
        associationFields: {},
        localFields: {},
    };

    table.columns.forEach(column => {
        switch (column.fieldTableAssociation) {
            // TODO: this should be handled generically by the field.
            case "tableColumn":
                if (fields[column.member] !== undefined) {
                    ret.localFields[column.member] = fields[column.member];
                }
                break;
            case "foreignObject":
                // foreign objects come in with a different member than column.member (FK member, not object member)
                const typedColumn = column as ForeignSingleField<TAnyModel>;
                if (fields[typedColumn.member] !== undefined) {
                    ret.localFields[typedColumn.member] = fields[typedColumn.member];
                }
                if (fields[typedColumn.fkidMember!] !== undefined) {
                    ret.localFields[typedColumn.fkidMember!] = fields[typedColumn.fkidMember!];
                }
                if (!fields[typedColumn.fkidMember!] && !!fields[typedColumn.member]) {
                    // if we're able to populate the fk member go ahead. assumes the foreign model's pk is 'id'
                    ret.localFields[typedColumn.fkidMember!] = fields[typedColumn.member].id;
                }
                break;
            case "associationRecord":
                if (fields[column.member] !== undefined) {
                    ret.associationFields[column.member] = fields[column.member];
                }
                break;
            case "calculated":
                // strip calculated values from any mutation
                break;
            default:
                throw new Error(`unknown field table association; field:${column.member}`);
                break;
        }
    });

    // fields which are not known to the schema will be ignored / discarded by the result

    return ret;
};
