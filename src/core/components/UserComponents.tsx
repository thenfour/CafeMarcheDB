import React from "react";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { UserChip } from "./CMCoreComponents";
import { ChooseItemDialog } from "./ChooseItemDialog";
import { gIconMap } from "../db3/components/IconMap";
import { Prisma } from "db";
import { Breadcrumbs, Button, Link, Tooltip } from "@mui/material";
import { getURIForUser } from "../db3/clientAPILL";
import { IsNullOrWhitespace } from "shared/utils";
import HomeIcon from '@mui/icons-material/Home';
import { useDashboardContext } from "./DashboardContext";
import { useRouter } from "next/router";
import { SortDirection } from "shared/rootroot";
import { DiscreteCriterion } from "../db3/shared/apiTypes";




////////////////////////////////////////////////////////////////////////////////////////////////////
export enum UserOrderByColumnOptions {
    id = "id",
    name = "name",
};

export type UserOrderByColumnOption = keyof typeof UserOrderByColumnOptions;

export interface UsersFilterSpec {
    quickFilter: string;
    refreshSerial: number; // this is necessary because you can do things to change the results from this page. think of adding an event then refetching.

    orderByColumn: UserOrderByColumnOptions;
    orderByDirection: SortDirection;

    tagFilter: DiscreteCriterion;
    instrumentFilter: DiscreteCriterion;
    roleFilter: DiscreteCriterion;
};





//////////////////////////////////////////////////////////////////////////////////////
export interface AddUserButtonProps {
    buttonChildren?: React.ReactNode;
    filterPredicate?: (u: db3.UserPayload) => boolean;
    onSelect: (u: db3.UserPayload | null) => void;
    title?: React.ReactNode;
    description?: React.ReactNode;
};

// todo: potential to make this more generic. add vs. change, for generic values.
export const AddUserButton = (props: AddUserButtonProps) => {
    const [addUserOpen, setAddUserOpen] = React.useState<boolean>(false);
    const buttonChildren = props.buttonChildren || <>{gIconMap.Add()} Add users</>;

    const tableClient = DB3Client.useTableRenderContext({
        tableSpec: new DB3Client.xTableClientSpec({
            table: db3.xUser,
            columns: [
                new DB3Client.PKColumnClient({ columnName: "id" }),
            ],
        }),
        requestedCaps: DB3Client.xTableClientCaps.Query | DB3Client.xTableClientCaps.Mutation,
        clientIntention: { intention: "user", mode: 'primary' },
    });

    let filteredItems: db3.UserPayload[] = tableClient.items as any;
    if (props.filterPredicate) {
        filteredItems = filteredItems.filter(u => props.filterPredicate!(u));
    }

    const handleOpen = () => {
        setAddUserOpen(true);
    };

    const handleOK = (u: db3.UserPayload | null) => {
        props.onSelect(u);
        setAddUserOpen(false);
    };

    return <>
        <Button onClick={handleOpen}>{buttonChildren}</Button>
        {addUserOpen &&
            <ChooseItemDialog
                closeOnSelect={true}
                isEqual={(a: db3.UserMinimumPayload, b: db3.UserMinimumPayload) => a.id === b.id}
                items={filteredItems}
                value={null as db3.UserPayload | null}
                title={props.title || "Add user"}
                onCancel={() => setAddUserOpen(false)}
                onOK={(u: db3.UserPayload) => handleOK(u)}
                renderValue={(u) => <UserChip value={u.value} />}
                renderAsListItem={(p, u: db3.UserPayload) => <UserChip value={u} />}
                description={props.description}
            />}
    </>;
};


////////////////////////////////////////////////////////////////
export interface UserBreadcrumbProps {
    user: Prisma.UserGetPayload<{ select: { id: true, name: true } }>,
};
export const UserBreadcrumbs = (props: UserBreadcrumbProps) => {
    return <Breadcrumbs aria-label="breadcrumb">
        <Link
            underline="hover"
            color="inherit"
            sx={{ display: 'flex', alignItems: 'center' }}
            href="/backstage"
        >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Backstage
        </Link>
        <Link
            underline="hover"
            color="inherit"
            href="/backstage/users"
            sx={{ display: 'flex', alignItems: 'center' }}
        >
            Users
        </Link>

        <Link
            underline="hover"
            color="inherit"
            href={getURIForUser(props.user)}
            sx={{ display: 'flex', alignItems: 'center' }}
        >
            {IsNullOrWhitespace(props.user.name) ? props.user.id : props.user.name}
        </Link>

    </Breadcrumbs>
        ;
};




////////////////////////////////////////////////////////////////
export interface UserDetailArgs {
    user: db3.EnrichedVerboseUser;
    tableClient: DB3Client.xTableRenderClient;
    readonly: boolean;
}

export const UserDetail = ({ user, tableClient, ...props }: UserDetailArgs) => {
    const dashboardContext = useDashboardContext();
    const router = useRouter();

    const refetch = () => {
        tableClient.refetch();
    };

    //const fileInfo = GetSongFileInfo(song, dashboardContext);

    //const [selectedTab, setSelectedTab] = React.useState<SongDetailTabSlug>(props.initialTab || ((IsNullOrWhitespace(song.description) && (fileInfo.enrichedFiles.length > 0)) ? SongDetailTabSlug.files : SongDetailTabSlug.info));

    // convert index to tab slug
    //const songData = CalculateSongMetadata(song, selectedTab);

    // React.useEffect(() => {
    //     void router.replace(songData.songURI, undefined, { shallow: true }); // shallow prevents annoying re-scroll behavior
    // }, [songData.songURI]);

    // const handleTabChange = (newId: string) => {
    //     const slug = StringToEnumValue(SongDetailTabSlug, (newId || "").toString()) || SongDetailTabSlug.info;
    //     setSelectedTab(slug);
    // }

    return <div>{user.name}</div>

    // return <SongDetailContainer readonly={props.readonly} songData={songData} tableClient={tableClient} showVisibility={true}>

    //     <SongMetadataView readonly={props.readonly} refetch={refetch} songData={songData} showCredits={true} />

    //     <CMTabPanel
    //         selectedTabId={selectedTab}
    //         handleTabChange={(e, newId) => handleTabChange(newId as string)}
    //     >
    //         <CMTab
    //             thisTabId={SongDetailTabSlug.info}
    //             summaryTitle={"Info"}
    //             summaryIcon={gIconMap.Info()}
    //             canBeDefault={!IsNullOrWhitespace(song.description)}
    //         >
    //             <SongDescriptionControl readonly={props.readonly} refetch={refetch} song={song} />
    //         </CMTab>
    //         <CMTab
    //             thisTabId={SongDetailTabSlug.parts}
    //             summaryTitle={"Parts"}
    //             summaryIcon={gIconMap.LibraryMusic()}
    //             summarySubtitle={fileInfo.partitions.length}
    //             canBeDefault={!!fileInfo.partitions.length}
    //         >
    //             <FilesTabContent
    //                 fileTags={fileInfo.partitions}
    //                 readonly={props.readonly}
    //                 refetch={refetch}
    //                 uploadTags={{
    //                     taggedSongId: song.id,
    //                     fileTagId: dashboardContext.fileTag.find(t => t.significance === db3.FileTagSignificance.Partition)?.id,
    //                 }}
    //             />
    //         </CMTab>
    //         <CMTab
    //             thisTabId={SongDetailTabSlug.recordings}
    //             summaryTitle={"Recordings"}
    //             summaryIcon={gIconMap.PlayCircleOutline()}
    //             summarySubtitle={fileInfo.recordings.length}
    //             canBeDefault={!!fileInfo.recordings.length}
    //         >
    //             <FilesTabContent
    //                 fileTags={fileInfo.recordings}
    //                 readonly={props.readonly}
    //                 refetch={refetch}
    //                 uploadTags={{
    //                     taggedSongId: song.id,
    //                     fileTagId: dashboardContext.fileTag.find(t => t.significance === db3.FileTagSignificance.Recording)?.id,
    //                 }}
    //             />
    //         </CMTab>
    //         <CMTab
    //             thisTabId={SongDetailTabSlug.files}
    //             summaryTitle={"All files"}
    //             summaryIcon={gIconMap.AttachFile()}
    //             summarySubtitle={song.taggedFiles.length}
    //             canBeDefault={!!song.taggedFiles.length}
    //         >
    //             <FilesTabContent fileTags={fileInfo.enrichedFiles} readonly={props.readonly} refetch={refetch} uploadTags={{
    //                 taggedSongId: song.id,
    //             }} />
    //         </CMTab>
    //         <CMTab
    //             thisTabId={SongDetailTabSlug.history}
    //             summaryTitle={"Stats"}
    //             summaryIcon={gIconMap.Equalizer()}
    //         >
    //             <SongHistory song={song} />
    //         </CMTab>
    //     </CMTabPanel>


    // </SongDetailContainer>;

};

