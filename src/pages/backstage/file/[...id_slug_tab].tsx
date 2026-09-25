import { formatFileSize } from "@/shared/rootroot";
import { loadAuthorizedPageEntity } from "@/src/auth/server/serverPageAuthorization";
import { gSSP } from "@/src/blitz-server";
import { CMChipContainer } from "@/src/core/components/CMChip";
import { InstrumentChip } from "@/src/core/components/CMCoreComponents";
import { AdminInspectObject, KeyValueTable, Pre } from "@/src/core/components/CMCoreComponents2";
import { CMLink } from "@/src/core/components/CMLink";
import { DateValue } from "@/src/core/components/DateTime/DateTimeComponents";
import { EditFieldsDialogButton, EditFieldsDialogButtonApi } from "@/src/core/components/EditFieldsDialog";
import { SettingMarkdown } from "@/src/core/components/SettingMarkdown";
import { useSnackbar } from "@/src/core/components/SnackbarContext";
import { AudioPlayerFileControls, FileExternalLink } from "@/src/core/components/SongFileComponents";
import { VisibilityValue } from "@/src/core/components/VisibilityControl";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { NavRealm } from "@/src/core/components/dashboard/StaticMenuItems";
import { useDashboardContext, useFeatureRecorder, useRecordFeatureUse } from "@/src/core/components/dashboardContext/DashboardContext";
import { EventChip } from "@/src/core/components/event/EventChips";
import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
import { FileTagChip } from "@/src/core/components/file/FileChip";
import { Markdown } from "@/src/core/components/markdown/Markdown";
import { SongChip } from "@/src/core/components/song/SongChip";
import { UserChip } from "@/src/core/components/user/userChip";
import { WikiPageChip } from "@/src/core/components/wiki/WikiPageChip";
import { gIconMap } from "@/src/core/db3/components/IconMap";
import { SharedAPI } from "@/src/core/db3/shared/sharedAPI";
import { BlitzPage } from "@blitzjs/next";
import HomeIcon from '@mui/icons-material/Home';
import { Breadcrumbs } from "@mui/material";
import db from "db";
import { Suspense } from 'react';
import { Permission } from "shared/permissions";
import { CoerceToNumberOrNull, parseMimeType } from "shared/utils";
import { AppContextMarker } from "src/core/components/AppContext";
import { FileTableClientColumns } from "src/core/components/file/FileComponentsBase";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";

////////////////////////////////////////////////////////////////
export interface FileBreadcrumbProps {
    file: db3.FileDetailClient,
};
export const FileBreadcrumbs = (props: FileBreadcrumbProps) => {
    const dashboardContext = useDashboardContext();
    return <Breadcrumbs aria-label="breadcrumb">
        <CMLink
            href="/backstage"
        >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Backstage
        </CMLink>
        <CMLink
            href="/backstage/files"
        >
            Files
        </CMLink>

        <CMLink
            href={dashboardContext.routingApi.getURIForFileLandingPage(props.file)}
        >
            {props.file.fileLeafName}
        </CMLink>
    </Breadcrumbs>
        ;
};


interface FileDetailProps {
    file: db3.FileDetailClient;
    readonly: boolean;
    tableClient: DB3Client.xTableRenderClient<typeof db3.fileDetailView>;
};


const FileDetail = ({ file, readonly, tableClient }: FileDetailProps) => {
    const dashboardContext = useDashboardContext();
    const visInfo = dashboardContext.getVisibilityInfo({
        visiblePermissionId: file.visiblePermissionId ?? null,
    });
    const recordFeature = useFeatureRecorder();
    const snackbar = useSnackbar();
    const editCommands = DB3Client.useCrudViewCommands({
        view: db3.fileEditorView,
        tableClient,
    });

    const mimeInfo = parseMimeType(file.mimeType);
    const isAudio = mimeInfo?.type === 'audio';

    const imageInfo = file.storedLeafName !== undefined
        && file.customData !== undefined
        && file.mimeType !== undefined
        ? SharedAPI.files.getImageFileDimensions({
            id: file.id,
            storedLeafName: file.storedLeafName,
            customData: file.customData,
            mimeType: file.mimeType,
        })
        : undefined;

    return (
        <div className={`fileDetail ${visInfo.className}`} style={{ maxWidth: '800px', margin: '20px 0' }}>

            {tableClient && <EditFieldsDialogButton
                dialogTitle='Edit song'
                dialogDescription={<SettingMarkdown setting='EditSongDialogDescription' />}
                readonly={readonly}
                initialValue={file}
                renderButtonChildren={() => <>{gIconMap.Edit()} Edit</>}
                tableSpec={tableClient.tableSpec}
                tableRenderClient={tableClient}
                onCancel={() => { }}
                onOK={async (obj, _tableClient, api: EditFieldsDialogButtonApi) => {
                    void recordFeature({
                        feature: ActivityFeature.file_edit,
                        context: "file edit dialog",
                    });
                    await snackbar.invokeAsync(async () => {
                        await editCommands.update(obj, file);
                        api.close();
                    });
                }}
                onDelete={async (api: EditFieldsDialogButtonApi) => {
                    void recordFeature({
                        feature: ActivityFeature.file_delete,
                        context: "file edit dialog",
                    });

                    await snackbar.invokeAsync(async () => {
                        await editCommands.delete(file.id);
                        api.close();
                    });
                }}
            />}

            <div className="fileDetailHeader" style={{ marginBottom: '20px' }}>
                <h1 style={{ margin: '0 0 10px 0', fontSize: '24px' }}>{file.fileLeafName}</h1>
                <AdminInspectObject src={file} label="FileObj" />
                {file.description && (
                    <div className="fileDescription" style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                        <Markdown markdown={file.description} />
                    </div>
                )}
                <div style={{ display: "flex" }}><VisibilityValue permissionId={file.visiblePermissionId} variant='minimal' /></div>
            </div>

            <KeyValueTable
                data={{
                    'Created At': file.fileCreatedAt ? <DateValue value={file.fileCreatedAt} /> : undefined,
                    'Uploaded At': <><DateValue value={file.uploadedAt} /> {file.uploadedByUser && <>by <UserChip value={file.uploadedByUser} /></>}</>,
                    ...(dashboardContext.isShowingAdminControls ? {
                        'Stored Leaf Name': <Pre>{file.storedLeafName}</Pre>,
                    } : {}),
                    'External URI': file.externalURI ? <a href={file.externalURI} target="_blank" rel="noopener noreferrer">{file.externalURI}</a> : '',
                    "Audio controls": isAudio ? (
                        <AudioPlayerFileControls file={file} />
                    ) : '',
                    "Image dimensions": imageInfo ? (
                        <span>{imageInfo.width} x {imageInfo.height} px</span>
                    ) : '',
                    "Mime Type": file.mimeType || 'Unknown',
                    'Size': file.sizeBytes ? formatFileSize(file.sizeBytes) : 'Unknown',
                    "Tags": (file.tags && file.tags.length > 0) ? (
                        <CMChipContainer>
                            {file.tags.map(tag => (
                                <FileTagChip
                                    key={db3.xFileTagAssignment.getIdentity(tag)}
                                    value={tag.fileTag}
                                />))}
                        </CMChipContainer>) : "",
                    "Tagged Users": (file.taggedUsers && file.taggedUsers.length > 0) ? (
                        <CMChipContainer>
                            {file.taggedUsers.map((taggedUser, index) => (
                                <UserChip key={index} value={taggedUser.user} />
                            ))}
                        </CMChipContainer>) : undefined,
                    "Tagged Songs": (file.taggedSongs && file.taggedSongs.length > 0) ?
                        (<CMChipContainer>
                            {file.taggedSongs.map((taggedSong, index) => (
                                taggedSong.song.name !== undefined
                                    ? <SongChip key={index} value={{ id: taggedSong.song.id, name: taggedSong.song.name }} />
                                    : null
                            ))}
                        </CMChipContainer>) : "",
                    "Tagged Events": (file.taggedEvents && file.taggedEvents.length > 0) ?
                        (<CMChipContainer>
                            {file.taggedEvents.map((taggedEvent, index) => {
                                const event = taggedEvent.event;
                                return event.name !== undefined
                                    && event.startsAt !== undefined
                                    && event.statusId !== undefined
                                    && event.typeId !== undefined
                                    ? <EventChip key={index} value={{
                                        publicId: event.publicId,
                                        name: event.name,
                                        startsAt: event.startsAt,
                                        statusId: event.statusId,
                                        typeId: event.typeId,
                                    }} />
                                    : null;
                            })}
                        </CMChipContainer>) : "",
                    "Tagged Instruments": (file.taggedInstruments && file.taggedInstruments.length >
                        0) ? (
                        <CMChipContainer>
                            {file.taggedInstruments.map((taggedInstrument, index) => (
                                <InstrumentChip key={index} value={taggedInstrument.instrument} />
                            ))}
                        </CMChipContainer>) : "",
                    "Tagged Wiki Pages": (file.taggedWikiPages && file.taggedWikiPages.length > 0) ?
                        (<CMChipContainer>
                            {file.taggedWikiPages.map((taggedWikiPage, index) => (
                                taggedWikiPage.wikiPage.slug !== undefined
                                    ? <WikiPageChip key={index} slug={taggedWikiPage.wikiPage.slug} />
                                    : null
                            ))}
                        </CMChipContainer>) : "",
                    "Frontpage gallery usage": file.frontpageGalleryItems && file.frontpageGalleryItems.length || "",
                    "Parent File": <>{file.parentFile ? <CMLink href={dashboardContext.routingApi.getURIForFileLandingPage(file.parentFile)}>{file.parentFile.fileLeafName}</CMLink> : ''}</>,
                    "Child files": <CMChipContainer>
                        {file.childFiles && file.childFiles.length > 0 && (
                            file.childFiles.map((childFile, index) => (
                                <CMLink key={index} href={dashboardContext.routingApi.getURIForFileLandingPage(childFile)}>{childFile.fileLeafName}</CMLink>
                            ))
                        )}
                    </CMChipContainer>,
                    "Preview File": file.previewFile ? <CMLink href={dashboardContext.routingApi.getURIForFileLandingPage(file.previewFile)}>{file.previewFile.fileLeafName}</CMLink> : '',
                    "Preview for": <CMChipContainer>
                        {file.previewForFile && file.previewForFile.length > 0 && (
                            file.previewForFile.map((previewForFile, index) => (
                                <CMLink key={index} href={dashboardContext.routingApi.getURIForFileLandingPage(previewForFile)}>{previewForFile.fileLeafName}</CMLink>
                            ))
                        )}
                    </CMChipContainer>,
                    "Pinned for songs": <CMChipContainer>
                        {file.pinnedForSongs && file.pinnedForSongs.length > 0 && (
                            file.pinnedForSongs.map((pinnedSong, index) => (
                                pinnedSong.name !== undefined
                                    ? <SongChip key={index} value={{ id: pinnedSong.id, name: pinnedSong.name }} />
                                    : null
                            ))
                        )}</CMChipContainer>,
                    ...(dashboardContext.isShowingAdminControls && file.customData ? {
                        "Custom Data": <AdminInspectObject src={file.customData} label="Custom data" />,
                    } : {}),
                    "Actions": (
                        <div>
                            <FileExternalLink file={file} />
                        </div>
                    ),
                }}
            />
        </div>
    );
};

const MyComponent = ({ fileId }: { fileId: number | null }) => {
    if (!fileId) throw new Error(`file not found`);

    const dashboardContext = useDashboardContext();

    useRecordFeatureUse({ feature: ActivityFeature.file_detail_view, fileId });

    const tableSpec = DB3Client.defineTableClientSpec({
        view: db3.fileDetailView,
        columns: DB3Client.makeClientColumnSelection(
            FileTableClientColumns.id,
            FileTableClientColumns.fileLeafName,
            FileTableClientColumns.description,
            FileTableClientColumns.tags,
            FileTableClientColumns.taggedEvents,
            FileTableClientColumns.taggedUsers,
            FileTableClientColumns.taggedInstruments,
            FileTableClientColumns.taggedSongs,
            FileTableClientColumns.taggedWikiPages,
            FileTableClientColumns.visiblePermission,

            FileTableClientColumns.mimeType,
            FileTableClientColumns.sizeBytes,
            FileTableClientColumns.customData,
        ),
    });
    const tableClient = DB3Client.useTableRenderContext({
        requestedCaps: DB3Client.xTableClientCaps.Query,
        tableSpec,
        referenceProvider: dashboardContext.referenceStore,
        filterModel: {
            tableParams: { fileId },
        },
    });
    if (tableClient.items.length > 1) throw new Error(`db returned too many files; issues with filtering? exploited slug/id? count=${tableClient.items.length}`);
    if (tableClient.items.length < 1) throw new Error(`File not found`);

    const file = tableClient.items[0]!;

    return (
        <div className="fileDetailComponent">
            {file ? (
                <>
                    <FileBreadcrumbs file={file} />
                    <FileDetail readonly={false} file={file} tableClient={tableClient} />
                </>
            ) : (
                <>
                    <p>No file was found. Some possibilities:</p>
                    <ul>
                        <li>The file was deleted or you don't have permission to view it</li>
                        <li>The file's slug (name) or ID changed</li>
                    </ul>
                </>
            )}
        </div>
    );
};

interface PageProps {
    title: string;
    fileId: number | null;
}

export const getServerSideProps = gSSP<PageProps>(async ({ params, ctx }) => {
    const [id__] = params!.id_slug_tab as string[];
    const id = CoerceToNumberOrNull(id__);
    if (!id) return { notFound: true };

    const file = await loadAuthorizedPageEntity({
        ctx,
        permission: Permission.access_file_landing_page,
        table: db3.xFile,
        identity: id,
        load: where => db.file.findFirst({
            select: {
                id: true,
                fileLeafName: true,
            },
            where,
        }),
    });
    if (!file) return { notFound: true };

    return { props: { title: file.fileLeafName, fileId: file.id } };
});

const FileDetailPage: BlitzPage = (x: PageProps) => {
    return (
        <DashboardLayout title={x.title} navRealm={NavRealm.files}>
            <AppContextMarker name="file page" fileId={x.fileId || undefined}>
                <Suspense>
                    <MyComponent fileId={x.fileId} />
                </Suspense>
            </AppContextMarker>
        </DashboardLayout>
    );
};

export default FileDetailPage;
