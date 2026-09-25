import type { DB3IdentityOf, xTable } from "../shared/db3core";
import { generatePublicId as generatePublicIdValue, isPublicIdUniqueCollision } from "@/src/server/publicId";
import { prepareDB3ReadSelection, type DB3ReadSelectionArgs } from "../shared/core/db3ReadSelection";

/**
 * Server-only operations bound to one DB3 table. The shared xTable remains the
 * authority for identity typing and validation without acquiring Node-only
 * dependencies.
 */
export class DB3ServerTable<TEntity extends xTable> {
    constructor(readonly entity: TEntity) { }

    prepareReadSelection(selection: DB3ReadSelectionArgs, requiredRootMembers: readonly string[] = []) {
        return prepareDB3ReadSelection(this.entity, selection, requiredRootMembers);
    }

    // makes sure all authorization columns are present in the model.
    // this is used to make sure the database returned everything we need to perform
    // auth.
    assertReadAuthorizationInput(model: Readonly<Record<string, unknown>>, path: string): void {
        for (const member of this.entity.getReadAuthorizationMembers()) {
            if (!Object.prototype.hasOwnProperty.call(model, member) || model[member] === undefined) {
                throw new Error(`DB3 read '${path}.${member}' is missing required authorization data for ${this.entity.tableID}.`);
            }
        }
    }

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

    async createWithPublicId<TResult>(
        this: Extract<DB3IdentityOf<TEntity>, string> extends never
            ? never
            : DB3ServerTable<TEntity>,
        create: (publicId: Extract<DB3IdentityOf<TEntity>, string>) => Promise<TResult>,
    ): Promise<TResult> {
        for (let attempt = 0; attempt < 8; ++attempt) {
            const publicId = this.generatePublicId();
            try {
                return await create(publicId);
            } catch (error) {
                // Other unique constraints carry domain meaning and must not retry.
                if (!isPublicIdUniqueCollision(error)) throw error;
            }
        }
        throw new Error(`Unable to generate a unique public ID for ${this.entity.tableID}.`);
    }
}

export const db3Server = {
    table<TEntity extends xTable>(entity: TEntity): DB3ServerTable<TEntity> {
        return new DB3ServerTable(entity);
    },
};
