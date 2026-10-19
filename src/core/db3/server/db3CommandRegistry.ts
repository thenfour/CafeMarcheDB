import { eventSongListDeleteCommandHandler, eventSongListReorderCommandHandler } from "./commands/eventSongListOperations";
import { getDB3CrudViewForCommand } from "../db3";
import type { AnyDB3CommandHandler } from "./db3CommandCore";
import { DB3CommandError } from "./db3CommandCore";
import { defineEntityCrudCommandHandlers } from "./db3EntityCrudCommand";
import { eventSongListSaveCommandHandler } from "./commands/eventSongListSaveCommand";
import { galleryReorderCommandHandler } from "./commands/galleryOperations";
import { menuLinkReorderCommandHandler } from "./commands/menuLinkOperations";
import { bandInstrumentCommandHandler } from "./commands/bandInstrumentCommand";
import { bandUserInstrumentsCommandHandler } from "./commands/bandUserInstrumentsCommand";
import { bandUserTagsCommandHandler } from "./commands/bandUserTagsCommand";
import { bandUserRoleCommandHandler } from "./commands/bandUserRoleCommand";
import { bandUserProfileCommandHandler } from "./commands/bandUserProfileCommand";
import { bandUserLifecycleCommandHandler } from "./commands/bandUserLifecycleCommand";
import { bandRolePermissionSetCommandHandler, globalRolePermissionSetCommandHandler } from "./commands/rolePermissionSetCommand";
import { platformUserAccountCreateCommandHandler, userAccountCreateCommandHandler } from "./commands/userAccountCreateCommands";

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
    globalRolePermissionSetCommandHandler,
    bandRolePermissionSetCommandHandler,
    userAccountCreateCommandHandler,
    platformUserAccountCreateCommandHandler,
    bandInstrumentCommandHandler,
    bandUserInstrumentsCommandHandler,
    bandUserTagsCommandHandler,
    bandUserRoleCommandHandler,
    bandUserProfileCommandHandler,
    bandUserLifecycleCommandHandler,
    eventSongListSaveCommandHandler,
    eventSongListDeleteCommandHandler,
    eventSongListReorderCommandHandler,
    galleryReorderCommandHandler,
    menuLinkReorderCommandHandler,
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
        // Explicit lifecycle handlers keep ownership when another operation is generated.
        if (!commandHandlers.has(handler.command.commandID)) {
            registerDB3CommandHandler(handler);
        }
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
