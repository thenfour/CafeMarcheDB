import { TableAccessor } from "@/shared/rootroot";
import { Prisma } from "db";


export type EnrichMenuLinkInput = Partial<Prisma.MenuLinkGetPayload<{
}>>;
export type EnrichedMenuLink<T extends EnrichMenuLinkInput> = Omit<T,
    // omit fields that may appear on input that we'll replace.
    "visiblePermission"
> & Prisma.MenuLinkGetPayload<{ // add the stuff we're enriching with.
    select: { // must be select so we don't accidentally require all fields.
        visiblePermission: true,
    }
}>;

// takes a bare event and applies eventstatus, type, visiblePermission, et al
export function enrichMenuLink<T extends EnrichMenuLinkInput>(
    item: T,
    data: {
        permission: TableAccessor<Prisma.PermissionGetPayload<{}>>;
    },
): EnrichedMenuLink<T> {
    // original payload type,
    // removing items we're replacing,
    // + stuff we're adding/changing.
    return {
        ...item,
        visiblePermission: data.permission.getById(item.visiblePermissionId),
    };
}




