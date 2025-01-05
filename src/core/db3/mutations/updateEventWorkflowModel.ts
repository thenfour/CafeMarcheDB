// updateEventWorkflowModel
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { Permission } from "shared/permissions";


export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (args: {}, ctx: AuthenticatedCtx) => {
        debugger; // todo: this mutation.
        return {};
    }
);

