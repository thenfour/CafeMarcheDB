import React from 'react';
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";

interface SongsContextValue {
    songs: db3.SongClientPayload[];
    //loading: boolean;         // Whether we are currently fetching data
    //error: string | null;     // Any error message
}

// This is what we’ll provide in our context
export const SongsContext = React.createContext<SongsContextValue>({
    songs: [],
    //loading: false,
    //error: null,
});

interface SongsProviderProps {
    children: React.ReactNode;
}

export const useSongsContext = () => React.useContext(SongsContext);

export function SongsProvider({ children }: SongsProviderProps) {
    const client = DB3Client.useDb3Query<db3.SongClientPayload>({ schema: db3.xSong });

    return (
        <SongsContext.Provider value={{ songs: client.items }}>
            {children}
        </SongsContext.Provider>
    );
}


