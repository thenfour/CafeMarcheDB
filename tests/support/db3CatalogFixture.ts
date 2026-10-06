import type { Prisma } from "@prisma/client";
import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import type { AnyDB3CrudView } from "src/core/db3/shared/core/db3CrudView";
import type { DB3Identity } from "src/core/db3/shared/db3core";
import { createCommandRowServices } from "src/core/db3/server/db3CommandCore";
import { getDB3CommandHandler } from "src/core/db3/server/db3CommandRegistry";

/** Run real generated CRUD inside the fixture's rollback transaction with its fresh authorization. */
export async function executeCatalogCrud(tx: Prisma.TransactionClient, authorization: CMServerAuthorization,
    view: AnyDB3CrudView, values: unknown, identity?: DB3Identity,
): Promise<{ identity: DB3Identity }> {
    const command = identity === undefined ? view.crud.operations.create?.command : view.crud.operations.update.command;
    if (!command) {
        throw new Error(`View '${view.viewID}' does not permit creation.`);
    }
    const payload = command.parseDto(identity === undefined ? values : { identity, patch: values });
    const handler = getDB3CommandHandler(command.commandID);
    const auth = await authorization.refresh(tx);
    const result = await handler.execute(payload, { authorization: auth, transaction: tx,
        rowServices: createCommandRowServices(auth, tx) });
    return { identity: view.entity.identitySchema.parse(result.identity) };
}
