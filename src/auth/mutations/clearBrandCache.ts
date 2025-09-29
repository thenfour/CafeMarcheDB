import { resolver } from "@blitzjs/rpc";
import { z } from "zod";
import { Permission } from "shared/permissions";
import { clearBrandCache } from "@/src/server/brand";

const ClearBrandCacheSchema = z.object({
  host: z.string().optional(),
});

export default resolver.pipe(
  resolver.zod(ClearBrandCacheSchema),
  resolver.authorize(Permission.sysadmin),
  async ({ host }, ctx) => {
    try {
      clearBrandCache(host || undefined);
      return { ok: true };
    } catch (e) {
      console.error("Error clearing brand cache", e);
      throw e;
    }
  }
);
