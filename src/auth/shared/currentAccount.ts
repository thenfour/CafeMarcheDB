import type { UserPublicId } from "shared/publicId";
import type { UserWithRolesPayload } from "src/core/db3/shared/schema/userPayloads";

/** Shared account data only. Band roles and assignments come from membership views. */
export type CurrentAccount = Pick<UserWithRolesPayload,
    "id" | "name" | "email" | "phone" | "createdAt" | "cssClass" | "isSysAdmin"
> & { readonly publicId: UserPublicId };
