import { formatFileSize } from "@/shared/rootroot";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { readFileDetailPage } from "src/core/db3/server/fileDetailPage";
import { pagePresentationInput } from "src/locale/shared/pagePresentationInput";
import { withMemberPresentation } from "src/core/components/user/bandMemberLinks";
import { gSSP } from "@/src/blitz-server";
import { CMChipContainer } from "@/src/core/components/CMChip";
import { InstrumentChip } from "@/src/core/components/CMCoreComponents";
import { AdminInspectObject, KeyValueTable, Pre } from "@/src/core/components/CMCoreComponents2";
import { CMLink } from "@/src/core/components/CMLink";
import { DateValue } from "@/src/core/components/DateTime/DateTimeComponents";
import { EditFieldsDialogButton, EditFieldsDialogButtonApi } from "@/src/core/components/EditFieldsDialog";
import { BandLocalizedMarkdown } from "@/src/setting/client/components/SettingMarkdown";
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
import { useRouter } from "next/router";
import { Suspense } from 'react';
import type { FilePublicId } from "shared/publicId";
import { parseMimeType } from "shared/utils";
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
            href={withMemberPresentation("/backstage", dashboardContext.memberPresentation)}
        >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Backstage
        </CMLink>
        <CMLink
            href={withMemberPresentation("/backstage/files", dashboardContext.memberPresentation)}
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
    const router = useRouter();
    const visInfo = dashboardContext.getVisibilityInfo({
        visiblePermissionId: file.visiblePermissionId ?? null,
    });
    const recordFeature = useFeatureRecorder();
    const snackbar = useSnackbar();
    const editCommands = DB3Client.useCrudViewCommands({
        view: db3.fileEditorView,
        tableClient,
    });
    const deleteFile = DB3Client.useDB3Command(db3.fileEditorView.crud.operations.delete.command);

    const mimeInfo = parseMimeType(file.mimeType);
    const isAudio = mimeInfo?.type === 'audio';

    const imageInfo = file.storedLeafName !== undefined
        && file.customData !== undefined
        && file.mimeType !== undefined
        ? SharedAPI.files.getImageFileDimensions({
            //publicId: file.publicId,
            storedLeafName: file.storedLeafName,
            customData: file.customData,
            mimeType: file.mimeType,
        })
        : undefined;

    return (
        <div className={`fileDetail ${visInfo.className}`} style={{ maxWidth: '800px', margin: '20px 0' }}>

            {tableClient && <EditFieldsDialogButton
                dialogTitle='Edit file'
                dialogDescription={<BandLocalizedMarkdown id='EditFileDialogDescription' />}
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
                        // A deleted detail target cannot be refetched. Return to the File list after committing.
                        await deleteFile.invoke({ identity: file.publicId });
                        api.close();
                        await router.push(withMemberPresentation("/backstage/files", dashboardContext.memberPresentation));
                        await dashboardContext.refreshCachedData();
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
                                    key={db3.xBandFileTagAssignment.getIdentity(tag)}
                                    value={tag.bandFileTag}
                                />))}
                        </CMChipContainer>) : "",
                    "Tagged Users": (file.taggedUsers && file.taggedUsers.length > 0) ? (
                        <CMChipContainer>
                            {file.taggedUsers.map((taggedUser, index) => (
                                <UserChip key={index} value={taggedUser.bandUser.user} />
                            ))}
                        </CMChipContainer>) : undefined,
                    "Tagged Songs": (file.taggedSongs && file.taggedSongs.length > 0) ?
                        (<CMChipContainer>
                            {file.taggedSongs.map((taggedSong, index) => (
                                taggedSong.song.name !== undefined
                                    ? <SongChip key={index} value={{ publicId: db3.xSong.parseIdentity(taggedSong.song.publicId), name: taggedSong.song.name }} />
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
                                <InstrumentChip key={index} value={taggedInstrument.bandInstrument} />
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
                                    ? <SongChip key={index} value={{ publicId: pinnedSong.publicId, name: pinnedSong.name }} />
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

const FileDetailContent = ({ fileId }: { fileId: FilePublicId }) => {
    const dashboardContext = useDashboardContext();

    useRecordFeatureUse({ feature: ActivityFeature.file_detail_view, fileId });

    const tableSpec = DB3Client.defineTableClientSpec({
        view: db3.fileDetailView,
        columns: DB3Client.makeClientColumnSelection(
            FileTableClientColumns.publicId,
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
        queryOptions: { staleTime: 0, cacheTime: 0, keepPreviousData: false },
        filterModel: {
            tableParams: { fileId },
        },
    });
    const file = tableClient.items[0];

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
    readonly title: string;
    readonly fileId: FilePublicId;
}

export const getServerSideProps = gSSP<PageProps>(async ({ params, query, req, ctx }) => {
    const path = params?.id_slug_tab;
    const identity = Array.isArray(path) ? path[0] : undefined;
    const input = pagePresentationInput(query, req.headers["accept-language"]);
    if (!db3.xFile.isIdentity(identity) || !input.bandPublicId) {
        return { notFound: true };
    }
    const auth = await loadAuthorization(ctx.session, input.bandPublicId);
    const result = await readFileDetailPage(db, auth, input, db3.xFile.parseIdentity(identity));
    return result ? { props: result } : { notFound: true };
});

const FileDetailScope = ({ fileId }: Pick<PageProps, "fileId">) => {
    const dashboard = useDashboardContext();
    return <FileDetailContent key={`${dashboard.authorizationContext?.bandPublicId}:${fileId}`} fileId={fileId} />;
};

const FileDetailPage: BlitzPage = (x: PageProps) => {
    return (
        <DashboardLayout title={x.title} navRealm={NavRealm.files}>
            <AppContextMarker name="file page" fileId={x.fileId}>
                <Suspense>
                    <FileDetailScope fileId={x.fileId} />
                </Suspense>
            </AppContextMarker>
        </DashboardLayout>
    );
};

export default FileDetailPage;
