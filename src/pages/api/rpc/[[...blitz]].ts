import { rpcHandler } from "@blitzjs/rpc"
import { api } from "src/blitz-server"

export default api(rpcHandler({
    onError: (error, ctx) => console.log(error),
    logging: {
        // logs all query data...
        verbose: false,
    }
}))
