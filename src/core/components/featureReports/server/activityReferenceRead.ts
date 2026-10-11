import { z } from "zod";
import type { AnyDB3View, DtoOf } from "src/core/db3/shared/core/db3View";
import { queryView, type QueryViewInput } from "src/core/db3/server/db3QueryCore";
import type { DB3ReadContext } from "src/core/db3/server/db3ReadExecution";

/** A report reference is withheld when any of its transported fields is unavailable. */
export async function readActivityReferenceView<TView extends AnyDB3View>(context: DB3ReadContext, input: QueryViewInput<TView>): Promise<DtoOf<TView>[]> {
    const auth = context.authorization;
    const view = input.view;
    if (!(view.dtoSchema instanceof z.ZodObject)) {
        throw new Error("Activity references require an object view.");
    }
    if (!input.filter.publicIds?.length || !view.entity.authorizeTableForView(auth) || Object.keys(view.dtoSchema.shape).some(columnName =>
        !view.entity.authorizeColumnForView({ auth, model: null, columnName }))) {
        return [];
    }
    return (await queryView(input, auth, context)).items;
}

export function activityReferenceLabel(value: string | null | undefined): string {
    if (value === undefined) {
        throw new Error("An authorized activity reference is missing its label.");
    }
    // An authorized localized field can have no available text; keep the same blank label as navigation.
    return value ?? "";
}

export function activityReferenceField<T>(value: T | undefined): T {
    if (value === undefined) {
        throw new Error("An authorized activity reference is incomplete.");
    }
    return value;
}

/** Natural identities only correlate server rows with the public reference owner's output. */
export function correlateActivityReferences<TReference extends { readonly publicId: string }>(
    identities: readonly { readonly id: number; readonly publicId: string }[], items: readonly TReference[],
): ReadonlyMap<number, TReference> {
    const byPublicId = new Map(items.map(row => [row.publicId, row]));
    return new Map(identities.flatMap(row => {
        const item = byPublicId.get(row.publicId);
        if (!item) {
            return [];
        }
        const entry: [number, TReference] = [row.id, item];
        return [entry];
    }));
}
