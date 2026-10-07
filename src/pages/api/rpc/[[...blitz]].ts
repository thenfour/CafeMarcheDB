import { rpcHandler } from "@blitzjs/rpc"
import { api } from "src/blitz-server"

export default api(rpcHandler({
    // Node's object inspector can throw for validation errors; log their text instead.
    onError: error => console.error(error instanceof Error ? error.stack ?? error.message : String(error)),
    logging: {
        // logs all query data...
        verbose: false,
    }
}))
