import type { TAnyModel } from "@/shared/rootroot";
import { z } from "zod";
import {
    defineCommand,
    type DB3Command,
} from "./db3Command";
import type {
    AnyDB3Entity,
    ClientEntityOf,
    EntityIdOf,
} from "./db3Entity";

export interface DB3AssociationChange<
    TLocal extends TAnyModel,
    TForeign extends TAnyModel,
> {
    readonly local: TLocal;
    readonly foreign: TForeign;
    readonly isAssociated: boolean;
}

export type DB3AssociationCommand<
    TLocalEntity extends AnyDB3Entity,
    TForeignEntity extends AnyDB3Entity,
    TLocalIdentitySchema extends z.ZodType<EntityIdOf<TLocalEntity>>,
    TForeignIdentitySchema extends z.ZodType<EntityIdOf<TForeignEntity>>,
> = DB3Command<
    TLocalEntity,
    DB3AssociationChange<ClientEntityOf<TLocalEntity>, ClientEntityOf<TForeignEntity>>,
    z.ZodObject<{
        localIdentity: TLocalIdentitySchema;
        foreignIdentity: TForeignIdentitySchema;
        isAssociated: z.ZodBoolean;
    }, "strict">,
    z.ZodObject<{
        localIdentity: TLocalIdentitySchema;
        foreignIdentity: TForeignIdentitySchema;
        isAssociated: z.ZodBoolean;
    }, "strict">
> & {
    readonly localEntity: TLocalEntity;
    readonly foreignEntity: TForeignEntity;
};

export type AnyDB3AssociationCommand = DB3AssociationCommand<
    AnyDB3Entity,
    AnyDB3Entity,
    z.ZodType<any>,
    z.ZodType<any>
>;

/**
 * Defines the client/server contract for setting one cell in an association
 * matrix. The command serializes rich client rows to identities; its server
 * handler remains domain-owned because association policy is not ordinary row
 * CRUD.
 */
export function defineAssociationCommand<
    TLocalEntity extends AnyDB3Entity,
    TForeignEntity extends AnyDB3Entity,
    TLocalIdentitySchema extends z.ZodType<EntityIdOf<TLocalEntity>>,
    TForeignIdentitySchema extends z.ZodType<EntityIdOf<TForeignEntity>>,
>(args: {
    readonly commandID: string;
    readonly localEntity: TLocalEntity;
    readonly foreignEntity: TForeignEntity;
    readonly localIdentitySchema: TLocalIdentitySchema;
    readonly foreignIdentitySchema: TForeignIdentitySchema;
    readonly additionalInvalidationEntityIDs?: readonly string[];
}): DB3AssociationCommand<
    TLocalEntity,
    TForeignEntity,
    TLocalIdentitySchema,
    TForeignIdentitySchema
> {
    const payloadSchema = z.object({
        localIdentity: args.localIdentitySchema,
        foreignIdentity: args.foreignIdentitySchema,
        isAssociated: z.boolean(),
    }).strict();
    const command = defineCommand({
        commandID: args.commandID,
        entity: args.localEntity,
        dtoSchema: payloadSchema,
        resultSchema: payloadSchema,
        serialize: (
            input: DB3AssociationChange<
                ClientEntityOf<TLocalEntity>,
                ClientEntityOf<TForeignEntity>
            >,
        ) => ({
            localIdentity: args.localEntity.getIdentity(input.local),
            foreignIdentity: args.foreignEntity.getIdentity(input.foreign),
            isAssociated: input.isAssociated,
        }),
        invalidation: {
            mode: "caller",
            entityIDs: [
                args.localEntity.entityID,
                args.foreignEntity.entityID,
                ...(args.additionalInvalidationEntityIDs || []),
            ],
        },
    });
    return {
        ...command,
        localEntity: args.localEntity,
        foreignEntity: args.foreignEntity,
    };
}
