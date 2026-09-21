import type { TAnyModel } from "@/shared/rootroot";
import {
    getDefinedCrudOperations,
    type AnyDB3EntityEditorCommands,
    type AnyDB3GeneratedCrudOperation,
    type DB3GeneratedCrudOperation,
    type EntityIdOf,
} from "../db3";
import {
    defineCommandHandler,
    type AnyDB3CommandHandler,
    type DB3CommandHandler,
} from "./db3CommandCore";

type HandlerFor<TOperation> =
    TOperation extends DB3GeneratedCrudOperation<any, infer TCommand>
    ? DB3CommandHandler<TCommand>
    : undefined;

export type EntityCrudCommandHandlers<TCommands extends AnyDB3EntityEditorCommands> = {
    readonly create: HandlerFor<TCommands["operations"]["create"]>;
    readonly update: HandlerFor<TCommands["operations"]["update"]>;
    readonly delete: HandlerFor<TCommands["operations"]["delete"]>;
    readonly all: readonly AnyDB3CommandHandler[];
};

function defineEntityCrudOperationHandler(
    commands: AnyDB3EntityEditorCommands,
    operation: AnyDB3GeneratedCrudOperation,
): AnyDB3CommandHandler {
    switch (operation.kind) {
        case "create":
            return defineCommandHandler(operation.command, async (dto, context) => {
                const inserted = await context.rowServices.insert(commands.entity, dto as TAnyModel);
                const identity = commands.identitySchema.parse(
                    inserted[commands.entity.schema.clientIdMember],
                );
                return operation.command.parseResult({ identity });
            });

        case "update":
            return defineCommandHandler(operation.command, async (dto, context) => {
                const { identity, patch } = dto as { identity: unknown; patch: TAnyModel };
                await context.rowServices.update(
                    commands.entity,
                    identity as EntityIdOf<typeof commands.entity>,
                    patch,
                );
                return operation.command.parseResult({ identity });
            });

        case "delete":
            return defineCommandHandler(operation.command, async (dto, context) => {
                const { identity } = dto as { identity: unknown };
                await context.rowServices.delete(
                    commands.entity,
                    identity as EntityIdOf<typeof commands.entity>,
                    operation.deleteType,
                );
                return operation.command.parseResult({ identity });
            });
    }
}

/** Binds each enabled generated operation to the authoritative DB3 row services. */
export function defineEntityCrudCommandHandlers<
    TCommands extends AnyDB3EntityEditorCommands,
>(commands: TCommands): EntityCrudCommandHandlers<TCommands> {
    const handlers: Partial<Record<AnyDB3GeneratedCrudOperation["kind"], AnyDB3CommandHandler>> = {};
    const all = getDefinedCrudOperations(commands).map(operation => {
        const handler = defineEntityCrudOperationHandler(commands, operation);
        handlers[operation.kind] = handler;
        return handler;
    });

    return {
        create: handlers.create,
        update: handlers.update,
        delete: handlers.delete,
        all,
    } as unknown as EntityCrudCommandHandlers<TCommands>;
}
