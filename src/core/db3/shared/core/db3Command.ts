// shared db3 command infrastructure

import type { z } from "zod";
import type { AnyDB3Entity } from "./db3Entity";

export interface DB3CommandInvalidation {
    /**
     * DB3 does not currently own a normalized client query cache. Callers must
     * therefore refetch the affected views after a successful command.
     */
    // todo: explain what "mode" is -- with only "caller" it's not clear what that means.
    readonly mode: "caller";
    readonly entityIDs: readonly string[];
}

/**
 * A named write operation rooted at a DB3 entity.
 *
 * Commands are the write-side sibling of views: a view turns an authorized
 * transport DTO into a rich client value, while a command turns whatever
 * client-side value is convenient into a strict transport DTO. The server is
 * still responsible for validating, authorizing, and applying that DTO.
 * 
 */
export interface DB3Command<
    TEntity extends AnyDB3Entity,
    TClientInput,
    TDtoSchema extends z.ZodTypeAny,
    TResultSchema extends z.ZodTypeAny,
> {
    readonly commandID: string;

    // the root entity this command operates on. TODO: consider commands that don't 
    // operate on entities? or span multiple?
    readonly entity: TEntity;

    // the Zod schema for the transport request from client -> server
    readonly dtoSchema: TDtoSchema;
    // zod schema for the result sent back to client; that also needs to be validated.
    readonly resultSchema: TResultSchema;

    // describes the effect on cache
    readonly invalidation: DB3CommandInvalidation;

    // converts a mutable client react code facing draft object
    // to a serializable format over the wire.
    readonly serialize: (input: TClientInput) => z.infer<TDtoSchema>;

    parseDto(value: unknown): z.infer<TDtoSchema>;
    parseResult(value: unknown): z.infer<TResultSchema>;
}

export type AnyDB3Command = DB3Command<AnyDB3Entity, any, z.ZodTypeAny, z.ZodTypeAny>;

// extract the rich client input model type
export type CommandClientInputOf<TCommand extends AnyDB3Command> =
    TCommand extends DB3Command<AnyDB3Entity, infer TClientInput, z.ZodTypeAny, z.ZodTypeAny>
    ? TClientInput
    : never;

export type CommandDtoOf<TCommand extends AnyDB3Command> =
    z.infer<TCommand["dtoSchema"]>;

export type CommandResultOf<TCommand extends AnyDB3Command> =
    z.infer<TCommand["resultSchema"]>;

export function defineCommand<
    TEntity extends AnyDB3Entity,
    TClientInput,
    TDtoSchema extends z.ZodTypeAny,
    TResultSchema extends z.ZodTypeAny,
>(args: {
    commandID: string;
    entity: TEntity;
    dtoSchema: TDtoSchema;
    resultSchema: TResultSchema;
    serialize: (input: TClientInput) => z.infer<TDtoSchema>;
    invalidation?: DB3CommandInvalidation;
}): DB3Command<TEntity, TClientInput, TDtoSchema, TResultSchema> {
    return {
        ...args,
        invalidation: args.invalidation ?? {
            mode: "caller",
            entityIDs: [args.entity.entityID],
        },
        parseDto: value => args.dtoSchema.parse(value),
        parseResult: value => args.resultSchema.parse(value),
    };
}

export interface DB3CommandRequest {
    commandID: string;
    payload: unknown;
}
