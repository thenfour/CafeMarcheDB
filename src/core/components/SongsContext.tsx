import { Prisma } from "db";
import * as db3 from "src/core/db3/db3";
import React from 'react';
import * as DB3Client from "src/core/db3/DB3Client";
import { useDashboardContext } from "./DashboardContext";

interface SongsContextValue {
    songs: db3.SongPayload[];
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
    //const [songs, setSongs] = React.useState<db3.SongPayload[]>([]);
    //const [loading, setLoading] = useState<boolean>(true);
    //const [error, setError] = useState<string | null>(null);
    //useDashboardContext

    const client = DB3Client.useDb3Query(db3.xSong);

    // React.useEffect(() => {
    //     // const fetchSongs = async () => {
    //     //     try {
    //     //         setLoading(true);
    //     //         const response = await fetch('/api/songs');
    //     //         if (!response.ok) {
    //     //             throw new Error(`Error: ${response.status}`);
    //     //         }
    //     //         const data = await response.json();
    //     //         setSongs(data);
    //     //     } catch (err: any) {
    //     //         setError(err.message || 'Unknown error');
    //     //     } finally {
    //     //         setLoading(false);
    //     //     }
    //     // };

    //     // fetchSongs();

    // }, []);

    // const value: SongsContextValue = {
    //     songs,
    //     loading,
    //     error,
    // };

    return (
        <SongsContext.Provider value={{ songs: client.items as db3.SongPayload[] }}>
            {children}
        </SongsContext.Provider>
    );
}


