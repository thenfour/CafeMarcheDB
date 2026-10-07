import { resolver } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";
import { UserMergeInput } from "../userMergeSchemas";
import { requireRestoredApplicationFeature } from "src/core/shared/applicationRecovery";

export default resolver.pipe(
    resolver.zod(UserMergeInput),
    resolver.authorize(Permission.login),
    async () => requireRestoredApplicationFeature("accountMerge"),
);
