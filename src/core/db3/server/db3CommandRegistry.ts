import { eventSongListDeleteCommandHandler, eventSongListReorderCommandHandler } from "./commands/eventSongListOperations";
import { getDB3CrudViewForCommand } from "../db3";
import type { AnyDB3CommandHandler } from "./db3CommandCore";
import { DB3CommandError } from "./db3CommandCore";
import { defineEntityCrudCommandHandlers } from "./db3EntityCrudCommand";
import { eventSongListSaveCommandHandler } from "./commands/eventSongListSaveCommand";
import { rolePermissionSetCommandHandler } from "./commands/rolePermissionSetCommand";

const commandHandlers = new Map<string, AnyDB3CommandHandler>();

export function registerDB3CommandHandler(handler: AnyDB3CommandHandler): void {
    commandHandlers.set(handler.command.commandID, handler);
}


export function registerDB3CommandHandlers(handlers: AnyDB3CommandHandler[]): void {
    for (const handler of handlers) {
        commandHandlers.set(handler.command.commandID, handler);
    }
}

// why not register at the point of definition?
// A: because unit tests rely on these being created in ways that the above fails to do;
// simplest is to just make those registrations here.
registerDB3CommandHandlers([
    eventSongListSaveCommandHandler,
    eventSongListDeleteCommandHandler,
    eventSongListReorderCommandHandler,
    rolePermissionSetCommandHandler,
]);

function getGeneratedCrudCommandHandler(commandID: string): AnyDB3CommandHandler | undefined {
    const cached = commandHandlers.get(commandID);
    if (cached) {
        return cached;
    }

    const view = getDB3CrudViewForCommand(commandID);
    if (!view) return undefined;
    const handlers = defineEntityCrudCommandHandlers(view.crud);
    for (const handler of handlers.all) {
        registerDB3CommandHandler(handler);
    }
    return commandHandlers.get(commandID);
}

export function getDB3CommandHandler(commandID: string): AnyDB3CommandHandler {
    const handler = commandHandlers.get(commandID)
        || getGeneratedCrudCommandHandler(commandID);
    if (!handler) {
        throw new DB3CommandError(`Unknown DB3 command '${commandID}'.`);
    }
    return handler;
}
