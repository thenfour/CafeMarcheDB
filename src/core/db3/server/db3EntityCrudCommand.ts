import type { TAnyModel } from "@/shared/rootroot";
import type {
    AnyDB3EntityCreateUpdateCommands,
    AnyDB3EntityCrudCommands,
    AnyDB3EntityUpdateDeleteCommands,
    EntityIdOf,
} from "../db3";
import {
    defineCommandHandler,
    type DB3CommandHandler,
} from "./db3CommandCore";

type CrudCommandHandlers<TCrud extends AnyDB3EntityCrudCommands> = {
    readonly create: DB3CommandHandler<TCrud["createCommand"]>;
    readonly update: DB3CommandHandler<TCrud["updateCommand"]>;
    readonly delete: DB3CommandHandler<TCrud["deleteCommand"]>;
    readonly all: readonly [
        DB3CommandHandler<TCrud["createCommand"]>,
        DB3CommandHandler<TCrud["updateCommand"]>,
        DB3CommandHandler<TCrud["deleteCommand"]>,
    ];
};

type CreateUpdateCommandHandlers<TCommands extends AnyDB3EntityCreateUpdateCommands> = {
    readonly create: DB3CommandHandler<TCommands["createCommand"]>;
    readonly update: DB3CommandHandler<TCommands["updateCommand"]>;
    readonly all: readonly [
        DB3CommandHandler<TCommands["createCommand"]>,
        DB3CommandHandler<TCommands["updateCommand"]>,
    ];
};

type UpdateDeleteCommandHandlers<TCommands extends AnyDB3EntityUpdateDeleteCommands> = {
    readonly update: DB3CommandHandler<TCommands["updateCommand"]>;
    readonly delete: DB3CommandHandler<TCommands["deleteCommand"]>;
    readonly all: readonly [
        DB3CommandHandler<TCommands["updateCommand"]>,
        DB3CommandHandler<TCommands["deleteCommand"]>,
    ];
};

export function defineEntityCreateUpdateCommandHandlers<
    TCommands extends AnyDB3EntityCreateUpdateCommands,
>(commands: TCommands): CreateUpdateCommandHandlers<TCommands> {
    const create = defineCommandHandler(commands.createCommand, async (dto, context) => {
        const inserted = await context.rowServices.insert(commands.entity, dto as TAnyModel);
        const identity = commands.identitySchema.parse(
            inserted[commands.entity.schema.clientIdMember],
        );
        return commands.createCommand.parseResult({ identity });
    });

    const update = defineCommandHandler(commands.updateCommand, async (dto, context) => {
        const { identity, patch } = dto as { identity: unknown; patch: TAnyModel };
        await context.rowServices.update(
            commands.entity,
            identity as EntityIdOf<TCommands["entity"]>,
            patch,
        );
        return commands.updateCommand.parseResult({ identity });
    });

    return { create, update, all: [create, update] };
}

/**
 * Binds generated entity CRUD descriptors to the authoritative DB3 row
 * services. Registration remains explicit in db3CommandRegistry so importing a
 * shared entity module never causes server-side mutation registration.
 */
export function defineEntityCrudCommandHandlers<
    TCrud extends AnyDB3EntityCrudCommands,
>(crud: TCrud): CrudCommandHandlers<TCrud> {
    const { create, update } = defineEntityCreateUpdateCommandHandlers(crud);

    const deleteHandler = defineCommandHandler(crud.deleteCommand, async (dto, context) => {
        const { identity } = dto as { identity: unknown };
        await context.rowServices.delete(
            crud.entity,
            identity as EntityIdOf<TCrud["entity"]>,
            crud.deleteType,
        );
        return crud.deleteCommand.parseResult({ identity });
    });

    return {
        create,
        update,
        delete: deleteHandler,
        all: [create, update, deleteHandler],
    };
}

export function defineEntityUpdateDeleteCommandHandlers<
    TCommands extends AnyDB3EntityUpdateDeleteCommands,
>(commands: TCommands): UpdateDeleteCommandHandlers<TCommands> {
    const update = defineCommandHandler(commands.updateCommand, async (dto, context) => {
        const { identity, patch } = dto as { identity: unknown; patch: TAnyModel };
        await context.rowServices.update(
            commands.entity,
            identity as EntityIdOf<TCommands["entity"]>,
            patch,
        );
        return commands.updateCommand.parseResult({ identity });
    });

    const deleteHandler = defineCommandHandler(commands.deleteCommand, async (dto, context) => {
        const { identity } = dto as { identity: unknown };
        await context.rowServices.delete(
            commands.entity,
            identity as EntityIdOf<TCommands["entity"]>,
            commands.deleteType,
        );
        return commands.deleteCommand.parseResult({ identity });
    });

    return { update, delete: deleteHandler, all: [update, deleteHandler] };
}
