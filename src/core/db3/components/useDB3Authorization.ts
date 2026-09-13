import { useDashboardContext } from "src/core/components/dashboardContext/DashboardContext";

// These grants are for UI feedback. Server operations resolve their own request
// authorization and never accept authorization data from a browser payload.
export const useDB3Authorization = () => useDashboardContext().authorization;
