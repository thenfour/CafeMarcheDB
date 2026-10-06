// server-side db3 command execution core

import type { TAnyModel } from "@/shared/rootroot";
import { AuthorizationError, type AuthenticatedCtx } from "blitz";
import db from "db";
import type {
    AnyDB3Command,
    AnyDB3Table,
    CommandDtoOf,
    CommandResultOf,
    DB3CommandRequest,
    DB3IdentityOf, DB3AuthSpec
} from "../db3";
import type { TransactionalPrismaClient } from "../shared/apiTypes";
import {
    CallMutateEventHooks,
    DB3MutationAuthorizationError,
    deleteImpl,
    insertImpl,
    updateImpl,
} from "./db3mutationCore";
import { resolvePublicForeignIds, resolvePublicId } from "./db3PublicIds";
import { CMServerAuthorization, loadAuthorization } from "@/src/auth/server/serverAuthorization";
import type { BandPublicId } from "shared/publicId";
import { CatalogSourceField } from "../shared/columnTypes/inherited";

export class DB3CommandError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DB3CommandError";
    }
}

// db3 services available for command handlers.
// Row services span registered Prisma models; each entity owns field conversion and row authorization.
export interface DB3CommandRowService {
    optIn<TEntity extends AnyDB3Table>(entity: TEntity, sourcePublicId: string, values?: TAnyModel): Promise<TAnyModel>;

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
    readonly authorization: CMServerAuthorization;
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
    authorization: CMServerAuthorization,
    transactionalDb: TransactionalPrismaClient,
): Promise<number | string> {
    if (!entity.publicIdMember) {
        return identity;
    }
    if (typeof identity !== "string") {
        throw new DB3CommandError(`Expected a public ID for ${entity.tableID}.`);
    }
    // Administrators can edit or restore hidden entries; new references still resolve through ordinary visibility.
    const includeHidden = !!entity.bandScope?.hiddenMember && authorization.hasPermission(entity.bandScope.managePermission);
    return resolvePublicId(entity, identity, authorization, transactionalDb, true, { includeHidden });
}

function requireRowServiceScope(entity: AnyDB3Table, authorization: CMServerAuthorization): void {
    if (authorization.band && !entity.bandScope) {
        throw new DB3MutationAuthorizationError(entity.tableName, ["scope"]);
    }
    if (entity.bandScope) {
        authorization.requireBand();
    }
}

// creates wrappers around the internal `*Impl` functions; more consistent and type-aware.
export function createCommandRowServices(
    authorization: CMServerAuthorization,
    transactionalDb: TransactionalPrismaClient,
): DB3CommandRowService {
    return {
        optIn: async (entity, sourcePublicId, values = {}) => {
            requireRowServiceScope(entity, authorization);
            const scope = entity.bandScope;
            const sourceField = entity.columns.find((field): field is CatalogSourceField<DB3AuthSpec> => field instanceof CatalogSourceField);
            if (!scope?.inheritedSourceMember || !sourceField) {
                throw new DB3CommandError("The entity does not declare a global catalog source.");
            }
            authorization.requirePermission(scope.managePermission);
            const source = await transactionalDb[sourceField.sourceTable].findUniqueOrThrow({ where: { publicId: sourcePublicId } });
            const existing = await transactionalDb[entity.tableName].findFirst({
                where: { [scope.member]: authorization.requireBand().id, [scope.inheritedSourceMember]: source.id },
            });
            if (existing) {
                return existing;
            }
            const resolvedValues = await resolvePublicForeignIds(entity, values, authorization, transactionalDb);
            // The source was loaded by public identity above; ordinary CRUD cannot supply this server-owned dependency.
            return insertImpl<TAnyModel>(entity, resolvedValues, authorization, transactionalDb, { inheritedSourceId: source.id });
        },
        insert: async (entity, values) => {
            requireRowServiceScope(entity, authorization);
            const resolvedValues = await resolvePublicForeignIds(
                entity,
                values,
                authorization,
                transactionalDb,
            );
            return insertImpl<TAnyModel>(entity, resolvedValues, authorization, transactionalDb);
        },

        update: async (entity, identity, values) => {
            requireRowServiceScope(entity, authorization);
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
                authorization,
                transactionalDb,
            )).newModel;
        },

        delete: async (entity, identity, deleteType = "softWhenPossible") => {
            requireRowServiceScope(entity, authorization);
            const resolvedIdentity = await resolveEntityIdentity(
                entity,
                identity,
                authorization,
                transactionalDb,
            );
            if (typeof resolvedIdentity !== "number") {
                throw new DB3CommandError(`Resolved identity for ${entity.tableID} is not numeric.`);
            }
            await deleteImpl(entity, resolvedIdentity, authorization, deleteType, transactionalDb);
        },

        requireVisible: async (entity, identity) => {
            requireRowServiceScope(entity, authorization);
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
                auth: authorization,
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
            requireRowServiceScope(entity, authorization);
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
    bandPublicId?: BandPublicId | null,
): Promise<unknown> {
    if (request.commandID !== handler.command.commandID) {
        throw new DB3CommandError(
            `Command handler '${handler.command.commandID}' cannot execute '${request.commandID}'.`,
        );
    }
    const authorization = await (await loadAuthorization(ctx.session, bandPublicId)).refresh(transactionalDb);
    // Domain admission is declared by ownership-aware tables, independently of command names.
    if (authorization.band && !handler.command.entity.bandScope) {
        throw new AuthorizationError("This command has not migrated to band-scoped execution.");
    }
    const dto = handler.command.parseDto(request.payload);
    const rowServices = createCommandRowServices(authorization, transactionalDb);
    const result = await handler.execute(dto, {
        authorization,
        transaction: transactionalDb,
        rowServices,
    });
    return handler.command.parseResult(result);
}
