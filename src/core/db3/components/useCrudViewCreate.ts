import type { TAnyModel } from "@/shared/rootroot";
import { invoke } from "@blitzjs/rpc";
import { useDashboardContext } from "src/core/components/dashboardContext/DashboardContext";
import * as db3 from "../db3";
import db3queries from "../queries/db3queries";
import { useDB3Command } from "./useDB3Command";

export class DB3CreatedRowNotReadableError extends Error {
    constructor(view: db3.AnyDB3CrudView, identity: db3.DB3EntityId) {
        super(
            `Created ${view.entity.entityID} '${String(identity)}', but it is not readable through CRUD view '${view.viewID}'.`,
        );
        this.name = "DB3CreatedRowNotReadableError";
    }
}

/**
 * Reads a newly created row back through its named CRUD view. The command only
 * returns canonical identity; selectors need the authorized, hydrated row
 * before they can publish it as a selectable value.
 */
export async function fetchCreatedCrudViewRow<TView extends db3.AnyDB3CrudView>(
    view: TView,
    identity: db3.EntityIdOf<db3.EntityOf<TView>>,
    references: db3.DB3ReferenceProvider,
): Promise<db3.ClientOf<TView>> {
    const schema = view.entity.schema;
    const filter = schema.publicIdMember
        ? { items: [], publicIds: [String(identity)] }
        : {
            items: [{
                field: schema.pkMember,
                operator: "equals" as const,
                value: identity,
            }],
        };
    const result = await invoke(db3queries, {
        table: {
            tableID: schema.tableID,
            tableName: schema.tableName,
            viewID: view.viewID,
        },
        orderBy: undefined,
        take: 2,
        filter,
        cmdbQueryContext: `fetchCreatedCrudViewRow/${view.viewID}`,
    });

    if (result.items.length !== 1) {
        throw new DB3CreatedRowNotReadableError(view, identity);
    }
    const client = db3.hydrateView(
        view,
        view.parseDto(result.items[0]),
        references,
    );
    if (!Object.is(view.entity.getIdentity(client), identity)) {
        throw new DB3CreatedRowNotReadableError(view, identity);
    }
    return client;
}

export interface CrudViewCreateToken<TView extends db3.AnyDB3CrudView> {
    create(values: TAnyModel): Promise<db3.ClientOf<TView>>;
}

/** Creates through the generated command, then reads through the same view. */
export function useCrudViewCreate<TView extends db3.AnyDB3CrudView>(
    view: TView | undefined,
): CrudViewCreateToken<TView> | undefined {
    const command = useDB3Command(
        view && db3.hasGeneratedCreateCommand(view.crud)
            ? view.crud.createCommand
            : undefined,
    );
    const dashboard = useDashboardContext();
    if (!view || !command) return undefined;

    return {
        create: async values => {
            const result = await command.invoke(values);
            dashboard.refreshCachedData();
            return fetchCreatedCrudViewRow(
                view,
                result.identity as db3.EntityIdOf<db3.EntityOf<TView>>,
                dashboard.referenceStore,
            );
        },
    };
}
