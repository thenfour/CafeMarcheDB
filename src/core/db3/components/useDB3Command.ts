import { useDB3QueryContext } from "./useDB3Context";
import { queryClient } from "src/blitz-client";
import { useMutation } from "@blitzjs/rpc";
import executeDB3CommandMutation from "../mutations/executeDB3Command";
import type {
    AnyDB3Command,
    CommandClientInputOf,
    CommandResultOf,
} from "../shared/core/db3Command";

// hook return value; provides callers with the facilities
export interface DB3CommandToken<TCommand extends AnyDB3Command> {
    invoke(input: CommandClientInputOf<TCommand>): Promise<CommandResultOf<TCommand>>;
    readonly invalidation: TCommand["invalidation"];
}

export function useDB3Command<TCommand extends AnyDB3Command>(
    command: TCommand,
): DB3CommandToken<TCommand>;
export function useDB3Command<TCommand extends AnyDB3Command>(
    command: TCommand | undefined,
): DB3CommandToken<TCommand> | undefined;
export function useDB3Command<TCommand extends AnyDB3Command>(
    command: TCommand | undefined,
): DB3CommandToken<TCommand> | undefined {
    const [mutate] = useMutation(executeDB3CommandMutation);
    const queryContext = useDB3QueryContext();
    if (!command) {
        return undefined;
    }
    return {
        invalidation: command.invalidation,
        invoke: async input => {
            const payload = command.parseDto(command.serialize(input));
            const result = await mutate({
                commandID: command.commandID,
                payload,
                bandPublicId: queryContext.bandPublicId,
            });
            // todo: find a well-designed way to invalidate relevant queries
            return command.parseResult(result) as CommandResultOf<TCommand>;
        },
    };
}
