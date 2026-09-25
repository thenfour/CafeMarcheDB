import type { DB3IdentityOf, xTable } from "../shared/db3core";
import { generatePublicId as generatePublicIdValue } from "@/src/server/publicId";

/**
 * Server-only operations bound to one DB3 table. The shared xTable remains the
 * authority for identity typing and validation without acquiring Node-only
 * dependencies.
 */
export class DB3ServerTable<TEntity extends xTable> {
    constructor(readonly entity: TEntity) { }

    generatePublicId(
        this: Extract<DB3IdentityOf<TEntity>, string> extends never
            ? never
            : DB3ServerTable<TEntity>,
    ): Extract<DB3IdentityOf<TEntity>, string> {
        if (!this.entity.publicIdMember) {
            throw new Error(`Table ${this.entity.tableID} does not use public IDs.`);
        }
        const identity = this.entity.parseIdentity(generatePublicIdValue());
        if (typeof identity !== "string") {
            throw new Error(`Table ${this.entity.tableID} did not parse its generated public ID as a string.`);
        }
        // publicIdMember and parseIdentity jointly establish that this string is
        // the exact branded identity declared by TEntity.
        return identity as Extract<DB3IdentityOf<TEntity>, string>;
    }
}

export const db3Server = {
    table<TEntity extends xTable>(entity: TEntity): DB3ServerTable<TEntity> {
        return new DB3ServerTable(entity);
    },
};
