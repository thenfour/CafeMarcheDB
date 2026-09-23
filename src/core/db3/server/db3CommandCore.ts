// server-side db3 command execution core

import type { TAnyModel } from "@/shared/rootroot";
import type { AuthenticatedCtx } from "blitz";
import db from "db";
import type {
    AnyDB3Command,
    AnyDB3Table,
    CommandDtoOf,
    CommandResultOf,
    DB3Authorization,
    DB3CommandRequest,
    DB3IdentityOf
} from "../db3";
import { createDb3RequestAuthorization } from "../db3";
import type { TransactionalPrismaClient } from "../shared/apiTypes";
import {
    CallMutateEventHooks,
    DB3MutationAuthorizationError,
    deleteImpl,
    insertImpl,
    updateImpl,
} from "./db3mutationCore";
import { resolvePublicForeignIds, resolvePublicId } from "./db3PublicIds";

export class DB3CommandError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DB3CommandError";
    }
}

// db3 services available for command handlers.
export interface DB3CommandRowService {

    // wraps insertImpl
    insert<TEntity extends AnyDB3Table>(
        entity: TEntity,
        values: TAnyModel,
    ): Promise<TAnyModel>;

    update<TEntity extends AnyDB3Table>(
        entity: TEntity,
        identity: DB3IdentityOf<TEntity>,
        values: TAnyModel,
    ): Promise<TAnyModel>;

    delete<TEntity extends AnyDB3Table>(
        entity: TEntity,
        identity: DB3IdentityOf<TEntity>,
        deleteType?: "softWhenPossible" | "hard",
    ): Promise<void>;

    requireVisible<TEntity extends AnyDB3Table>(
        entity: TEntity,
        identity: DB3IdentityOf<TEntity>,
    ): Promise<TAnyModel>;

    afterMutation<TEntity extends AnyDB3Table>(
        entity: TEntity,
        model: TAnyModel & { id: number },
    ): Promise<void>;
}

export interface DB3CommandExecutionContext {
    readonly authorization: DB3Authorization;
    readonly transaction: TransactionalPrismaClient;
    readonly rowServices: DB3CommandRowService;
}

export interface DB3CommandHandler<TCommand extends AnyDB3Command> {
    readonly command: TCommand;
    readonly execute: (
        dto: CommandDtoOf<TCommand>,
        context: DB3CommandExecutionContext,
    ) => Promise<CommandResultOf<TCommand>>;
}

export type AnyDB3CommandHandler = DB3CommandHandler<AnyDB3Command>;

// helper fn to create a DB3CommandHandler<>
// note: when you create a command handler, add  it to the `commandHandlers` registry
// with registerDB3CommandHandler.
//
// so it's findable when the server tries to look them up from client requests.
export function defineCommandHandler<TCommand extends AnyDB3Command>(
    command: TCommand,
    execute: DB3CommandHandler<TCommand>["execute"],
): DB3CommandHandler<TCommand> {
    return { command, execute };
}

// used to convert id values to database internal numeric values.
// for things like client asking to delete an object - they don't have to pass in the whole entity, just the publicId.
// my instinct says this can go somewhere more general/central - either in db3 core, or the entity object itself.
// entities already have a getIdentity() method,
// but that operates on the entity model, not the id value
// this function resolves public ID using async db calls so it's a little bit special and deserves to be here at least for now.
async function resolveEntityIdentity<TEntity extends AnyDB3Table>(
    entity: TEntity,
    identity: DB3IdentityOf<TEntity>,
    authorization: DB3Authorization,
    transactionalDb: TransactionalPrismaClient,
): Promise<number | string> {
    if (!entity.publicIdMember) return identity;
    if (typeof identity !== "string") {
        throw new DB3CommandError(`Expected a public ID for ${entity.tableID}.`);
    }
    return resolvePublicId(entity, identity, authorization, transactionalDb, true);
}

// creates wrappers around the internal `*Impl` functions; more consistent and type-aware.
function createCommandRowServices(
    ctx: AuthenticatedCtx,
    authorization: DB3Authorization,
    transactionalDb: TransactionalPrismaClient,
): DB3CommandRowService {
    return {
        insert: async (entity, values) => {
            const resolvedValues = await resolvePublicForeignIds(
                entity,
                values,
                authorization,
                transactionalDb,
            );
            return insertImpl<TAnyModel>(entity, resolvedValues, ctx, transactionalDb);
        },

        update: async (entity, identity, values) => {
            const resolvedIdentity = await resolveEntityIdentity(
                entity,
                identity,
                authorization,
                transactionalDb,
            );
            if (typeof resolvedIdentity !== "number") {
                throw new DB3CommandError(`Resolved identity for ${entity.tableID} is not numeric.`);
            }
            const resolvedValues = await resolvePublicForeignIds(
                entity,
                values,
                authorization,
                transactionalDb,
            );
            return (await updateImpl(
                entity,
                resolvedIdentity,
                resolvedValues,
                ctx,
                transactionalDb,
            )).newModel;
        },

        delete: async (entity, identity, deleteType = "softWhenPossible") => {
            const resolvedIdentity = await resolveEntityIdentity(
                entity,
                identity,
                authorization,
                transactionalDb,
            );
            if (typeof resolvedIdentity !== "number") {
                throw new DB3CommandError(`Resolved identity for ${entity.tableID} is not numeric.`);
            }
            await deleteImpl(entity, resolvedIdentity, ctx, deleteType, transactionalDb);
        },

        requireVisible: async (entity, identity) => {
            if (!entity.authorizeTableForView(authorization)) {
                throw new DB3MutationAuthorizationError(entity.tableName, [entity.pkMember]);
            }
            const resolvedIdentity = await resolveEntityIdentity(
                entity,
                identity,
                authorization,
                transactionalDb,
            );
            const model = await transactionalDb[entity.tableName].findFirst({
                where: { [entity.pkMember]: resolvedIdentity },
            });
            if (!model) {
                throw new DB3CommandError(`${entity.tableID} '${String(identity)}' was not found.`);
            }
            const authorized = entity.authorizeAndSanitize({
                contextDesc: `command reference:${entity.tableID}`,
                model,
                publicData: authorization,
                rowMode: "view",
                includeDeleted: false,
                fallbackOwnerId: null,
            });
            if (!authorized.rowIsAuthorized) {
                throw new DB3MutationAuthorizationError(entity.tableName, [entity.pkMember]);
            }
            return model;
        },

        afterMutation: async (entity, model) => {
            await CallMutateEventHooks({
                tableNameOrSpecialMutationKey: entity.tableName,
                model,
                db: transactionalDb,
            });
        },
    };
}

// the rpc mutation entrypoint calls this
export async function executeDB3Command(
    request: DB3CommandRequest,
    handler: AnyDB3CommandHandler,
    ctx: AuthenticatedCtx,
    transactionalDb: TransactionalPrismaClient = db as any,
): Promise<unknown> {
    if (request.commandID !== handler.command.commandID) {
        throw new DB3CommandError(
            `Command handler '${handler.command.commandID}' cannot execute '${request.commandID}'.`,
        );
    }
    const authorization = await createDb3RequestAuthorization(ctx);
    const dto = handler.command.parseDto(request.payload);
    const rowServices = createCommandRowServices(ctx, authorization, transactionalDb);
    const result = await handler.execute(dto, {
        authorization,
        transaction: transactionalDb,
        rowServices,
    });
    return handler.command.parseResult(result);
}
