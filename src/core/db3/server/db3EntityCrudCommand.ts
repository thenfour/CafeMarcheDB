// i mean considering the R of "CRUD" means Read, and we only deal with mutation,
// it still has a better ring than "CUD"
import type { TAnyModel } from "@/shared/rootroot";
import type {
    AnyDB3EntityCrudCommands,
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

/**
 * Binds generated entity CRUD descriptors to the authoritative DB3 row
 * services. Registration remains explicit in db3CommandRegistry so importing a
 * shared entity module never causes server-side mutation registration.
 */
export function defineEntityCrudCommandHandlers<
    TCrud extends AnyDB3EntityCrudCommands,
>(crud: TCrud): CrudCommandHandlers<TCrud> {
    const create = defineCommandHandler(crud.createCommand, async (dto, context) => {
        const inserted = await context.rowServices.insert(crud.entity, dto as TAnyModel);
        const identity = crud.identitySchema.parse(
            inserted[crud.entity.schema.clientIdMember],
        );
        return crud.createCommand.parseResult({ identity });
    });

    const update = defineCommandHandler(crud.updateCommand, async (dto, context) => {
        const { identity, patch } = dto as { identity: unknown; patch: TAnyModel };
        await context.rowServices.update(
            crud.entity,
            identity as EntityIdOf<TCrud["entity"]>,
            patch,
        );
        return crud.updateCommand.parseResult({ identity });
    });

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
