import { concatenateUrlParts } from "@/shared/utils";


export const ServerApi = {
    // clients cannot access process.env. For client-side, use the routing API on the dashboardContext.
    getAbsoluteUri: (relativePath: string) => {
        return concatenateUrlParts(process.env.CMDB_BASE_URL!, relativePath);
    },

};
