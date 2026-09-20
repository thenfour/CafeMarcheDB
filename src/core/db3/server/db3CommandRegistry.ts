import type { AnyDB3CommandHandler } from "./db3CommandCore";
import { DB3CommandError } from "./db3CommandCore";
import { eventSongListSaveCommandHandler } from "./commands/eventSongListSaveCommand";

const commandHandlers = new Map<string, AnyDB3CommandHandler>([
    [eventSongListSaveCommandHandler.command.commandID, eventSongListSaveCommandHandler],
]);

export function getDB3CommandHandler(commandID: string): AnyDB3CommandHandler {
    const handler = commandHandlers.get(commandID);
    if (!handler) {
        throw new DB3CommandError(`Unknown DB3 command '${commandID}'.`);
    }
    return handler;
}
