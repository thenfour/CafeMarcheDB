import { AuthClientPlugin, AuthPluginClientOptions } from "@blitzjs/auth"
import { setupBlitzClient } from "@blitzjs/next"
import { BlitzRpcPlugin } from "@blitzjs/rpc"
import { shouldRetryQuery, shouldThrowQueryError } from "src/core/connectivity/connectionHealth"

export const authConfig: AuthPluginClientOptions = {
  cookiePrefix: "cmdb",
}

export const { withBlitz, queryClient } = setupBlitzClient({
  plugins: [AuthClientPlugin(authConfig), BlitzRpcPlugin({
    reactQueryOptions: {
      queries: {
        retry: shouldRetryQuery,
        useErrorBoundary: shouldThrowQueryError,
      },
    },
  })],
})
