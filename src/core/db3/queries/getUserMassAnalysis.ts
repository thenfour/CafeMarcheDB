import { resolver } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";
import { z } from "zod";
import { UserPublicIdSchema } from "src/auth/schemas";
import { requireRestoredApplicationFeature } from "src/core/shared/applicationRecovery";
import type { UserMassAnalysisResult } from "../shared/getUserMassAnalysisTypes";

export default resolver.pipe(
    resolver.zod(z.object({ userId: UserPublicIdSchema }).strict()),
    resolver.authorize(Permission.login),
    async (): Promise<UserMassAnalysisResult> => requireRestoredApplicationFeature("accountAnalysis"),
);
