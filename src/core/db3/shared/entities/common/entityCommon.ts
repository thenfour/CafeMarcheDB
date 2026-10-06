import { Permission } from "@/shared/permissions";
import { DB3FieldReadAuth, defineAuthMap } from "../../db3core";

export const kReadOnlyAuthMap = defineAuthMap({
    PostQuery: DB3FieldReadAuth.inheritRow,
    PostQueryAsOwner: DB3FieldReadAuth.inheritRow,
    PreInsert: Permission.never_grant,
    PreMutate: Permission.never_grant,
    PreMutateAsOwner: Permission.never_grant,
});
