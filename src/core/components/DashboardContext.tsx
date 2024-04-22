import React from 'react';
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";


interface DashboardContextType {
    instrumentFunctionalGroups: db3.InstrumentFunctionalGroupPayload[];
    roles: db3.RolePayload[];
    permissions: db3.PermissionPayload[];
    metronomeSilencers: (() => void)[];
};

export const DashboardContext = React.createContext<DashboardContextType>({
    instrumentFunctionalGroups: [],
    metronomeSilencers: [],
    roles: [],
    permissions: [],
});

export const DashboardContextProvider = ({ children }: React.PropsWithChildren<{}>) => {
    const valueRef = React.useRef<DashboardContextType>({
        instrumentFunctionalGroups: [],
        metronomeSilencers: [],
        roles: [],
        permissions: [],
    });

    const [user] = useCurrentUser();

    const clientIntention: db3.xTableClientUsageContext = { intention: 'user', mode: 'primary', currentUser: user };

    const functionalGroupsClient = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.Query,
        clientIntention,
        tableSpec: new DB3Client.xTableClientSpec({
            table: db3.xInstrumentFunctionalGroup,
            columns: [
                new DB3Client.PKColumnClient({ columnName: "id" }),
            ],
        }),
    });

    valueRef.current.instrumentFunctionalGroups = functionalGroupsClient.items as db3.InstrumentFunctionalGroupPayload[];

    const rolesClient = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.Query,
        clientIntention,
        tableSpec: new DB3Client.xTableClientSpec({
            table: db3.xRole,
            columns: [
                new DB3Client.PKColumnClient({ columnName: "id" }),
            ],
        }),
    });

    valueRef.current.roles = rolesClient.items as db3.RolePayload[];


    const permissionsClient = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.Query,
        clientIntention,
        tableSpec: new DB3Client.xTableClientSpec({
            table: db3.xPermission,
            columns: [
                new DB3Client.PKColumnClient({ columnName: "id" }),
            ],
        }),
    });

    valueRef.current.permissions = permissionsClient.items as db3.PermissionPayload[];


    return <DashboardContext.Provider value={valueRef.current}>
        {children}
    </DashboardContext.Provider>
};

