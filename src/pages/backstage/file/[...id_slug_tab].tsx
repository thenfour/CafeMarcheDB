import { formatFileSize } from "@/shared/rootroot";
import { CMChipContainer } from "@/src/core/components/CMChip";
import { InstrumentChip } from "@/src/core/components/CMCoreComponents";
import { AdminInspectObject, InspectObject, KeyValueTable, Pre } from "@/src/core/components/CMCoreComponents2";
import { CMLink } from "@/src/core/components/CMLink";
import { DateValue } from "@/src/core/components/DateTime/DateTimeComponents";
import { EditFieldsDialogButton, EditFieldsDialogButtonApi } from "@/src/core/components/EditFieldsDialog";
import { SettingMarkdown } from "@/src/core/components/SettingMarkdown";
import { useSnackbar } from "@/src/core/components/SnackbarContext";
import { AudioPlayerFileControls, FileExternalLink } from "@/src/core/components/SongFileComponents";
import { VisibilityValue } from "@/src/core/components/VisibilityControl";
import { EventChip } from "@/src/core/components/event/EventChips";
import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
import { Markdown } from "@/src/core/components/markdown/Markdown";
import { UserChip } from "@/src/core/components/user/userChip";
import { gIconMap } from "@/src/core/db3/components/IconMap";
import { SharedAPI } from "@/src/core/db3/shared/sharedAPI";
import { BlitzPage, useParams } from "@blitzjs/next";
import HomeIcon from '@mui/icons-material/Home';
import { Breadcrumbs } from "@mui/material";
import db from "db";
import React, { Suspense } from 'react';
import { Permission } from "shared/permissions";
import { CoerceToNumberOrNull, parseMimeType } from "shared/utils";
import { AppContextMarker } from "src/core/components/AppContext";
import { FileTableClientColumns } from "src/core/components/file/FileComponentsBase";
import * as DB3Client from "src/core/db3/DB3Client";
import { getURIForFileLandingPage } from "src/core/db3/clientAPILL";
import * as db3 from "src/core/db3/db3";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { FileTagChip } from "@/src/core/components/file/FileChip";
import { SongChip } from "@/src/core/components/song/SongChip";
import { WikiPageChip } from "@/src/core/components/wiki/WikiPageChip";
import { NavRealm } from "@/src/core/components/dashboard/StaticMenuItems";
import { EnrichedFile, enrichFile } from "@/src/core/db3/shared/schema/enrichedFileTypes";
import { useDashboardContext, useFeatureRecorder, useRecordFeatureUse } from "@/src/core/components/dashboardContext/DashboardContext";

////////////////////////////////////////////////////////////////
export interface FileBreadcrumbProps {
    file: EnrichedFile<db3.FilePayload>,
};
export const FileBreadcrumbs = (props: FileBreadcrumbProps) => {
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
            href={getURIForFileLandingPage(props.file)}
        >
            {props.file.fileLeafName}
        </CMLink>
    </Breadcrumbs>
        ;
};


interface FileDetailProps {
    file: EnrichedFile<db3.FilePayload>;
    readonly: boolean;
    tableClient: DB3Client.xTableRenderClient<db3.FilePayload>;
};


const FileDetail = ({ file, readonly, tableClient }: FileDetailProps) => {
    const dashboardContext = useDashboardContext();
    const visInfo = dashboardContext.getVisibilityInfo(file);
    const recordFeature = useFeatureRecorder();
    const snackbar = useSnackbar();

    const mimeInfo = parseMimeType(file.mimeType);
    const isAudio = mimeInfo?.type === 'audio';

    const refetch = tableClient.refetch;

    const imageInfo = SharedAPI.files.getImageFileDimensions(file);

    return (
        <div className={`fileDetail ${visInfo.className}`} style={{ maxWidth: '800px', margin: '20px 0' }}>

            {tableClient && <EditFieldsDialogButton
                dialogTitle='Edit song'
                dialogDescription={<SettingMarkdown setting='EditSongDialogDescription' />}
                readonly={readonly}
                initialValue={file}
                renderButtonChildren={() => <>{gIconMap.Edit()} Edit</>}
                tableSpec={tableClient.tableSpec}
                onCancel={() => { }}
                onOK={async (obj, tableClient: DB3Client.xTableRenderClient, api: EditFieldsDialogButtonApi) => {
                    void recordFeature({
                        feature: ActivityFeature.file_edit,
                        context: "file edit dialog",
                    });
                    await snackbar.invokeAsync(async () => {
                        await tableClient.doUpdateMutation(obj);
                        api.close();
                    });
                    refetch();
                }}
                onDelete={async (api: EditFieldsDialogButtonApi) => {
                    void recordFeature({
                        feature: ActivityFeature.file_delete,
                        context: "file edit dialog",
                    });

                    await snackbar.invokeAsync(async () => {
                        await tableClient.doDeleteMutation(file.id, 'softWhenPossible');
                        api.close();
                    });
                    refetch();
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
                    'Stored Leaf Name': <Pre>{file.storedLeafName}</Pre>,
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
                            {file.tags.map((tag, index) => (
                                <FileTagChip key={index} value={tag} />))}
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
                                <SongChip key={index} value={taggedSong.song} />
                            ))}
                        </CMChipContainer>) : "",
                    "Tagged Events": (file.taggedEvents && file.taggedEvents.length > 0) ?
                        (<CMChipContainer>
                            {file.taggedEvents.map((taggedEvent, index) => (
                                <EventChip key={index} value={taggedEvent.event} />
                            ))}
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
                                <WikiPageChip key={index} slug={taggedWikiPage.wikiPage.slug} />
                            ))}
                        </CMChipContainer>) : "",
                    "Frontpage gallery usage": file.frontpageGalleryItems && file.frontpageGalleryItems.length || "",
                    "Parent File": <>{file.parentFileId ? <CMLink href={getURIForFileLandingPage({ id: file.parentFileId })}>{file.parentFileId}</CMLink> : ''}</>,
                    "Child files": <CMChipContainer>
                        {file.childFiles && file.childFiles.length > 0 && (
                            file.childFiles.map((childFile, index) => (
                                <CMLink key={index} href={getURIForFileLandingPage(childFile)}>{childFile.id}</CMLink>
                            ))
                        )}
                    </CMChipContainer>,
                    "Preview File": file.previewFileId ? <CMLink href={getURIForFileLandingPage({ id: file.previewFileId })}>{file.previewFileId}</CMLink> : '',
                    "Preview for": <CMChipContainer>
                        {file.previewForFile && file.previewForFile.length > 0 && (
                            file.previewForFile.map((previewForFile, index) => (
                                <CMLink key={index} href={getURIForFileLandingPage(previewForFile)}>{previewForFile.id}</CMLink>
                            ))
                        )}
                    </CMChipContainer>,
                    "Pinned for songs": <CMChipContainer>
                        {file.pinnedForSongs && file.pinnedForSongs.length > 0 && (
                            file.pinnedForSongs.map((pinnedSong, index) => (
                                <SongChip key={index} value={pinnedSong} />
                            ))
                        )}</CMChipContainer>,
                    "Custom Data": file.customData ? <InspectObject src={file.customData} label="Custom data" /> : '',
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
    const params = useParams();
    const [id__, slug, tab] = params.id_slug_tab as string[];
    if (!fileId) throw new Error(`file not found`);

    const dashboardContext = useDashboardContext();

    useRecordFeatureUse({ feature: ActivityFeature.file_detail_view, fileId });

    const queryArgs: DB3Client.xTableClientArgs = {
        requestedCaps: DB3Client.xTableClientCaps.Query,
        clientIntention: dashboardContext.userClientIntention,
        tableSpec: new DB3Client.xTableClientSpec({
            table: db3.xFile,
            columns: [
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
            ],
        }),
        filterModel: {
            items: [],
            tableParams: {}
        }
    };

    queryArgs.filterModel!.tableParams!.fileId = fileId;

    const tableClient = DB3Client.useTableRenderContext<db3.FilePayload>(queryArgs);
    if (tableClient.items.length > 1) throw new Error(`db returned too many files; issues with filtering? exploited slug/id? count=${tableClient.items.length}`);
    if (tableClient.items.length < 1) throw new Error(`File not found`);

    const fileRaw = tableClient.items[0]!;
    const file = enrichFile(fileRaw, dashboardContext);

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

export const getServerSideProps = async ({ params }) => {
    const [id__, slug, tab] = params.id_slug_tab as string[];
    const id = CoerceToNumberOrNull(id__);
    if (!id) throw new Error(`no id`);

    const ret: { props: PageProps } = {
        props: {
            title: "File",
            fileId: null,
        }
    };

    const file = await db.file.findFirst({
        select: {
            id: true,
            fileLeafName: true,
        },
        where: {
            id,
        }
    });

    if (file) {
        ret.props.title = `${file.fileLeafName}`;
        ret.props.fileId = file.id;
    }

    return ret;
};

const FileDetailPage: BlitzPage = (x: PageProps) => {
    return (
        <DashboardLayout title={x.title} navRealm={NavRealm.files} basePermission={Permission.access_file_landing_page}>
            <AppContextMarker name="file page" fileId={x.fileId || undefined}>
                <Suspense>
                    <MyComponent fileId={x.fileId} />
                </Suspense>
            </AppContextMarker>
        </DashboardLayout>
    );
};

export default FileDetailPage;
