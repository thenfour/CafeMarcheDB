import React from 'react';
import { useCurrentUser } from 'src/auth/hooks/useCurrentUser';
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";


interface DashboardContextType {
    instrumentFunctionalGroups: db3.InstrumentFunctionalGroupPayload[];
};

export const DashboardContext = React.createContext<DashboardContextType>({
    instrumentFunctionalGroups: [],
});

export const DashboardContextProvider = ({ children }: React.PropsWithChildren<{}>) => {
    const valueRef = React.useRef<DashboardContextType>({
        instrumentFunctionalGroups: []
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

    return <DashboardContext.Provider value={valueRef.current}>
        {children}
    </DashboardContext.Provider>
};

