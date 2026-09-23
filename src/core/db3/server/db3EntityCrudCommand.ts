import type { TAnyModel } from "@/shared/rootroot";
import {
    getDefinedCrudOperations,
    type AnyDB3TableEditorCommands,
    type AnyDB3GeneratedCrudOperation,
    type DB3GeneratedCrudOperation,
    type DB3IdentityOf,
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

type MutableEntityCrudCommandHandlers<TCommands extends AnyDB3TableEditorCommands> = {
    create: HandlerFor<TCommands["operations"]["create"]> | undefined;
    update: HandlerFor<TCommands["operations"]["update"]> | undefined;
    delete: HandlerFor<TCommands["operations"]["delete"]> | undefined;
    all: (Readonly<AnyDB3CommandHandler>)[];
};

export type EntityCrudCommandHandlers<TCommands extends AnyDB3TableEditorCommands> = Readonly<MutableEntityCrudCommandHandlers<TCommands>>;

function defineEntityCrudOperationHandler(
    commands: AnyDB3TableEditorCommands,
    operation: AnyDB3GeneratedCrudOperation,
): AnyDB3CommandHandler {
    switch (operation.kind) {
        case "create":
            return defineCommandHandler(operation.command, async (dto, context) => {
                const inserted = await context.rowServices.insert(commands.entity, dto as TAnyModel);
                const identity = commands.identitySchema.parse(
                    inserted[commands.entity.clientIdMember],
                );
                return operation.command.parseResult({ identity });
            });

        case "update":
            return defineCommandHandler(operation.command, async (dto, context) => {
                const { identity, patch } = dto as { identity: unknown; patch: TAnyModel };
                await context.rowServices.update(
                    commands.entity,
                    identity as DB3IdentityOf<typeof commands.entity>,
                    patch,
                );
                return operation.command.parseResult({ identity });
            });

        case "delete":
            return defineCommandHandler(operation.command, async (dto, context) => {
                const { identity } = dto as { identity: unknown };
                await context.rowServices.delete(
                    commands.entity,
                    identity as DB3IdentityOf<typeof commands.entity>,
                    operation.deleteType,
                );
                return operation.command.parseResult({ identity });
            });
    }
}

/** Binds each enabled generated operation to the authoritative DB3 row services. */
export function defineEntityCrudCommandHandlers<
    TCommands extends AnyDB3TableEditorCommands,
>(commands: TCommands): EntityCrudCommandHandlers<TCommands> {
    const handlers: MutableEntityCrudCommandHandlers<TCommands> = {
        create: undefined,
        update: undefined,
        delete: undefined,
        all: [],
    };

    for (const operation of getDefinedCrudOperations(commands)) {
        const handler = defineEntityCrudOperationHandler(commands, operation);
        handlers.all.push(handler);
        handlers[operation.kind] = handler as any; // this cast is safe because the handler type matches the operation kind
    }

    return handlers;
}
