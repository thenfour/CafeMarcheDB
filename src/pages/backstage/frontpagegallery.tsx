import { defineCmdbPage } from "src/route/cmdbPage";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { authoredTranslationContext, resolveAuthoredTranslations } from "src/locale/shared/authoredTranslations";
import { useCmdbRouter } from "src/route/useCmdbRouter";

import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { useDashboardContext, useFeatureRecorder } from "@/src/core/components/dashboardContext/DashboardContext";
import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
import { HomepageMain } from "@/src/core/components/frontpage/CMHomepageComponents";
import { ImageEditParams, MakeDefaultImageEditParams, UpdateGalleryItemImageParams } from "@/src/core/db3/shared/fileTypes";
import type { PublicFeedResponseSpec } from "@/src/core/db3/shared/publicTypes";
import { SharedAPI } from "@/src/core/db3/shared/sharedAPI";
import { BlitzPage } from "@blitzjs/next";
import { useMutation } from "@blitzjs/rpc";
import { Tooltip } from "@mui/material";
import { assert } from "blitz";
import React from "react";
import * as ReactSmoothDnd /*{ Container, Draggable, DropResult }*/ from "react-smooth-dnd";
import { type EnNlFr } from "shared/lang";
import { Permission } from "shared/permissions";
import { Coord2D, formatFileSize } from "shared/rootroot";
import { calculateNewDimensions, gDefaultImageArea, IsNullOrWhitespace } from "shared/utils";
import { AppContextMarker } from "src/core/components/AppContext";
import { CMSinglePageSurfaceCard, JoystickDiv, ReactSmoothDndContainer, ReactSmoothDndDraggable, } from "src/core/components/CMCoreComponents";
import { CMButton, CMButtonGroup, KeyValueTable } from "src/core/components/CMCoreComponents2";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { VisibilityControl, VisibilityControlValue } from "src/core/components/VisibilityControl";
import { CMDBUploadFile } from "src/core/components/file/CMDBUploadFile";
import { CollapsableUploadFileComponent, FileDropWrapper } from "src/core/components/file/FileDrop";
import { galleryColumnSelection } from "src/core/components/file/GalleryColumns";
import { Markdown } from "src/core/components/markdown/Markdown";
import { Markdown3Editor } from "src/core/components/markdown/MarkdownControl3";
import { CMSelectDisplayStyle, SelectionField } from "src/core/components/select/SelectionField";
import { makeLocalSelectionSource } from "src/core/components/select/selectionSource";
import * as DB3Client from "src/core/db3/DB3Client";
import { gIconMap } from "src/core/db3/components/IconMap";
import { useDB3QueryContext } from "src/core/db3/components/useDB3Context";
import * as db3 from "src/core/db3/db3";
import updateGalleryItemImage from "src/core/db3/mutations/updateGalleryItemImage";
import { applyGalleryImageDrag, type ImageEditorTool } from "src/core/db3/shared/galleryImageEditor";
import { useLocale } from "src/locale/components/useLocale";
import { BandLocalizedMarkdown } from "src/setting/client/components/SettingMarkdown";

type FrontpageGalleryItemClient = db3.ClientOf<typeof db3.frontpageGalleryItemEditorView>;
type FrontpageGalleryClient = DB3Client.CrudTableRenderContext<typeof db3.frontpageGalleryItemEditorView>;
export interface NewGalleryItemComponentProps {
    client: FrontpageGalleryClient;
};


const ExistingImageSelection = ({ onSelect }: { onSelect: (fileId: db3.ClientOf<typeof db3.fileImageChoiceView>["publicId"]) => void }) => {
    const { getPlainString } = useLocale();
    const dashboard = useDashboardContext();
    const tableSpec = DB3Client.defineTableClientSpec({
        view: db3.fileImageChoiceView, columns: {
            publicId: DB3Client.publicIdFieldGen(),
        }
    });
    const client = DB3Client.useTableRenderContext({
        tableSpec, requestedCaps: DB3Client.xTableClientCaps.Query,
        referenceProvider: dashboard.referenceStore
    });
    const source = makeLocalSelectionSource({
        items: client.items, getKey: file => file.publicId,
        getLabel: file => file.fileLeafName, renderValue: file => file.fileLeafName
    });
    return <SelectionField source={source} value={[]} displayStyle={CMSelectDisplayStyle.SelectedWithDialog}
        dialogTitle={getPlainString("gallery.chooseImage")} onChange={values => {
            if (values[0]) {
                onSelect(values[0].publicId);
            }
        }} />;
};

const NewGalleryItemComponent = (props: NewGalleryItemComponentProps) => {
    const { getPlainString } = useLocale();
    const [progress, setProgress] = React.useState<number | null>(null);
    const busy = React.useRef(false);
    const dashboard = useDashboardContext();
    const { showMessage } = React.useContext(SnackbarContext);
    const create = DB3Client.useDB3Command(db3.frontpageGalleryItemEditorView.crud.operations.create!.command);
    const canUpload = dashboard.isAuthorized(Permission.upload_files);
    const canReadImages = dashboard.isAuthorized(Permission.view_files);
    const createItem = async (fileId: db3.ClientOf<typeof db3.fileImageChoiceView>["publicId"]) => {
        const permission = dashboard.getPermission(Permission.visibility_public);
        if (!permission) {
            throw new Error("Public visibility is unavailable.");
        }
        await create.invoke({
            fileId, sortOrder: props.client.items.reduce((next, item) => Math.max(next, item.sortOrder + 1), 0),
            caption: "", caption_fr: "", caption_nl: "", displayParams: JSON.stringify(MakeDefaultImageEditParams()),
            visiblePermissionId: db3.xPermission.getIdentity(permission)
        });
    };
    const addExistingImage = async (fileId: db3.ClientOf<typeof db3.fileImageChoiceView>["publicId"]) => {
        if (busy.current) {
            return;
        }
        busy.current = true; setProgress(0);
        try {
            await createItem(fileId); await props.client.refetch();
            showMessage({ severity: "success", children: getPlainString("gallery.created") });
        } catch (error) {
            showMessage({ severity: "error", children: `${getPlainString("gallery.createError")}: ${String(error)}` });
        } finally {
            busy.current = false; setProgress(null);
        }
    };
    const handleFileSelect = async (files: FileList) => {
        if (!canUpload || busy.current || files.length === 0) {
            return;
        }
        if (Array.from(files).some(file => !file.type.startsWith("image/"))) {
            showMessage({ severity: "error", children: getPlainString("gallery.imagesOnly") });
            return;
        }
        busy.current = true; setProgress(0);
        try {
            const response = await CMDBUploadFile({
                bandPublicId: dashboard.requireBandPublicId(), files,
                fields: { visiblePermissionId: db3.xPermission.getIdentity(dashboard.getPermission(Permission.visibility_public)!) },
                onProgress: progress01 => setProgress(progress01)
            });
            for (const file of response.files) {
                await createItem(file.publicId);
            }
            await props.client.refetch();
            showMessage({ severity: "success", children: `${response.files.length} file(s) uploaded and corresponding gallery items` });
        } catch (error) {
            showMessage({ severity: "error", children: `${getPlainString("gallery.uploadError")}: ${String(error)}` });
        } finally {
            busy.current = false; setProgress(null);
        }
    };
    return <FileDropWrapper enabled={canUpload} className="frontpageGalleryFileUploadWrapper" progress={progress}
        onFileSelect={files => void handleFileSelect(files)} onURLUpload={() => showMessage({ severity: "error", children: getPlainString("gallery.localImagesOnly") })}>
        <h2>Manage gallery items on the public homepage</h2>
        <CMSinglePageSurfaceCard className="filterControls"><div className="content">
            <CollapsableUploadFileComponent enabled={canUpload} progress={progress} onFileSelect={files => void handleFileSelect(files)} />
            {canReadImages && progress === null && <div>{getPlainString("gallery.addExistingImage")}<ExistingImageSelection onSelect={fileId => void addExistingImage(fileId)} /></div>}
        </div></CMSinglePageSurfaceCard>
    </FileDropWrapper>;
};

interface GalleryItemDescriptionEditorProps {
    refetch: () => void;
    onClose: () => void;
    galleryItem: FrontpageGalleryItemClient;
    client: FrontpageGalleryClient;
};

export const GalleryItemDescriptionEditor = (props: GalleryItemDescriptionEditorProps) => {
    const [valueEn, setValueEn] = React.useState<string>(props.galleryItem.caption);
    const [valueFr, setValueFr] = React.useState<string>(props.galleryItem.caption_fr || "");
    const [valueNl, setValueNl] = React.useState<string>(props.galleryItem.caption_nl || "");
    const recordFeature = useFeatureRecorder();

    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const handleSave = async (): Promise<boolean> => {
        try {
            void recordFeature({
                feature: ActivityFeature.frontpagegallery_item_edit,
                frontpageGalleryItemId: props.galleryItem.publicId,
            });
            const newrow: FrontpageGalleryItemClient = {
                ...props.galleryItem,
                caption: valueEn || "",
                caption_fr: valueFr || "",
                caption_nl: valueNl || "",
            };
            await props.client.crud.update(newrow, props.galleryItem);
            showSnackbar({ severity: "success", children: "Success" });
            props.client.refetch();
            return true;
        } catch (e) {
            console.log(e);
            showSnackbar({ severity: "error", children: "error updating gallery item description" });
            return false;
        }
    };

    const handleSaveAndClose = async (): Promise<boolean> => {
        const r = await handleSave();
        if (r) {
            props.onClose();
        }
        return r;
    };

    return <div className="frontpageGalleryCaptionEditorContainer">
        <h3>English</h3>
        <Markdown3Editor
            onChange={(v) => setValueEn(v)}
            value={valueEn}
            handleSave={() => { void handleSave() }}
            nominalHeight={80}
        />
        <h3>Nederlands</h3>
        <Markdown3Editor
            onChange={(v) => setValueNl(v)}
            value={valueNl}
            handleSave={() => { void handleSave() }}
            nominalHeight={80}
        />
        <h3>Français</h3>
        <Markdown3Editor
            onChange={(v) => setValueFr(v)}
            value={valueFr}
            handleSave={() => { void handleSave() }}
            nominalHeight={80}
        />

        <div className="actionButtonsRow">
            <div className={`freeButton cancelButton`} onClick={props.onClose}>Close</div>
            <div className={`saveButton saveAndCloseButton freeButton changed`} onClick={handleSaveAndClose}>{gIconMap.CheckCircleOutline()}Save & close</div>
        </div>
    </div>;
};


export interface GalleryItemDescriptionControlProps {
    value: FrontpageGalleryItemClient;
    client: FrontpageGalleryClient;
    editMode: boolean;
    setEditMode: (newValue: boolean) => void;
};
export const GalleryItemDescriptionControl = (props: GalleryItemDescriptionControlProps) => {
    return <div className='descriptionContainer'>
        {props.editMode && <GalleryItemDescriptionEditor
            onClose={() => props.setEditMode(false)}
            client={props.client}
            galleryItem={props.value}
            refetch={props.client.refetch}
        />}
        <KeyValueTable data={{
            English: IsNullOrWhitespace(props.value.caption) ? <i className="placeholder">none</i> : <Markdown markdown={props.value.caption} />,
            Nederlands: IsNullOrWhitespace(props.value.caption_nl) ? <i className="placeholder">none</i> : <Markdown markdown={props.value.caption_nl} />,
            Français: IsNullOrWhitespace(props.value.caption_fr) ? <i className="placeholder">none</i> : <Markdown markdown={props.value.caption_fr} />,
        }} />
    </div>;
};
type SelectedTool = ImageEditorTool;
export interface GalleryItemImageEditControlProps {
    value: FrontpageGalleryItemClient;
    client: FrontpageGalleryClient;
    onExitEditMode: () => void;
};
export const GalleryItemImageEditControl = (props: GalleryItemImageEditControlProps) => {
    const cmdbRouter = useCmdbRouter();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const recordFeature = useFeatureRecorder();
    const [updateImageMutation] = useMutation(updateGalleryItemImage);
    const dashboard = useDashboardContext();
    const [pending, setPending] = React.useState(false);
    const [lang, setLang] = React.useState<EnNlFr>("en");
    const [editingValue, setEditingValue] = React.useState<FrontpageGalleryItemClient>(() => {
        const ev: FrontpageGalleryItemClient = { ...props.value }; // create our own copy of the item, for live editing
        let editParams: ImageEditParams = MakeDefaultImageEditParams();
        const info = SharedAPI.files.getGalleryItemImageInfo(props.value);
        editParams = { ...info.displayParams }; // we need to adjust the file & edit params; start with a copy of existing edit params

        if (!editParams.cropSize) {// coalesce cropSize for convenience / simplicity.
            const info = SharedAPI.files.getGalleryItemImageInfo(props.value);
            editParams.cropSize = { ...info.fileDimensions };
        }
        ev.displayParams = JSON.stringify(editParams);

        return { ...ev };
    });

    const [selectedTool, setSelectedTool] = React.useState<SelectedTool>("Move");
    const info = SharedAPI.files.getGalleryItemImageInfo(editingValue);

    const reducedDimensions = calculateNewDimensions(info.cropSize, gDefaultImageArea);

    const setEditParams = (editParams: ImageEditParams) => {
        setEditingValue({ ...editingValue, displayParams: JSON.stringify(editParams) });
    };

    const handleSaveClick = () => {
        void recordFeature({
            feature: ActivityFeature.frontpagegallery_item_edit,
            frontpageGalleryItemId: editingValue.publicId,
            context: `ImageEditorBake`,
        });
        const args: UpdateGalleryItemImageParams = {
            bandPublicId: dashboard.requireBandPublicId(),
            galleryItemId: editingValue.publicId,
            imageParams: {
                quality: 80,
                outputType: "jpg",
                parentFileId: editingValue.fileId,
                newDimensions: { ...reducedDimensions },
                editParams: info.displayParams,
            },
        };
        setPending(true);
        updateImageMutation(args).then((r) => {
            showSnackbar({ severity: "success", children: `image updated.` });
            setEditParams({ ...r.newDisplayParams });
            props.onExitEditMode();
        }).catch((e) => {
            console.log(e);
            showSnackbar({ severity: "error", children: `error updating: ${e}` });
        }).finally(() => {
            setPending(false);
            void props.client.refetch();
        });
    };

    const handleSaveRotationClick = () => {
        void recordFeature({
            feature: ActivityFeature.frontpagegallery_item_edit,
            frontpageGalleryItemId: editingValue.publicId,
            context: `ImageEditorSave`,
        });
        setPending(true);
        props.client.crud.update(editingValue, props.value).then(() => {
            showSnackbar({ severity: "success", children: `params updated.` });
        }).catch((e) => {
            console.log(e);
            showSnackbar({ severity: "error", children: `error updating: ${e}` });
        }).finally(() => {
            setPending(false);
            void props.client.refetch();
        });
    };

    const handleDragMove = (delta: Coord2D) => {
        setEditParams(applyGalleryImageDrag(info.fileDimensions, info.displayParams, selectedTool, delta));
    };
    const presentationSnapshot = usePresentation();
    const content: PublicFeedResponseSpec = {
        agenda: [], gallery: [{
            galleryItemId: editingValue.publicId, fileId: editingValue.fileId, sortOrder: editingValue.sortOrder,
            caption: resolveAuthoredTranslations({ en: editingValue.caption, nl: editingValue.caption_nl, fr: editingValue.caption_fr },
                authoredTranslationContext({ ...dashboard.memberPresentation, routeLocale: lang },
                    presentationSnapshot.data?.localization.availability.band ?? [])),
            imageFileUri: cmdbRouter.getURIForFile(editingValue.file), storedLeafName: editingValue.file.storedLeafName,
            editParams: info.displayParams, customData: editingValue.file.customData,
            displayParams: editingValue.displayParams, mimeType: editingValue.file.mimeType,
        }]
    };

    const origArea = info.fileDimensions.width * info.fileDimensions.height;
    const croppedArea = info.cropSize.width * info.cropSize.height;
    const croppedSizeP = croppedArea / origArea;
    const reducedArea = reducedDimensions.width * reducedDimensions.height;
    const reducedSizeP = reducedArea / origArea;

    return (<div className="imageEditControlContainer ImageEditor editorMain">
        <CMButtonGroup className="ImageEditor toolbar">
            <CMButton disabled={pending} onClick={() => setSelectedTool("CropBegin")} className={`toolbutton ${selectedTool === "CropBegin" && "selected"}`}>begin</CMButton>
            <CMButton disabled={pending} onClick={() => setSelectedTool("CropEnd")} className={`toolbutton ${selectedTool === "CropEnd" && "selected"}`}>end</CMButton>
            <CMButton disabled={pending} onClick={() => setSelectedTool("Move")} className={`toolbutton ${selectedTool === "Move" && "selected"}`}>Move</CMButton>
            <CMButton disabled={pending} onClick={() => setSelectedTool("Scale")} className={`toolbutton ${selectedTool === "Scale" && "selected"}`}>Scale</CMButton>
            <CMButton disabled={pending} onClick={() => setSelectedTool("Rotate")} className={`toolbutton ${selectedTool === "Rotate" && "selected"}`}>Rotate</CMButton>
            <Tooltip title={"Reset edits"}>
                <CMButton disabled={pending} onClick={() => {
                    setEditParams(MakeDefaultImageEditParams());
                }} className={`toolbutton resetIcon`}>⟲</CMButton>
            </Tooltip>
            <Tooltip title={"Click here to process the image with cropping. The idea is your crops probably result in a smaller image for more efficient page download. If you didn't crop anything don't bother with this. Bake creates a new cropped, rotated and resized image file. Do this if you are sure you're done with edits."}>
                <CMButton disabled={pending || !dashboard.isAuthorized(Permission.upload_files)} onClick={handleSaveClick} className={`toolbutton save`}>{gIconMap.Save()} Bake new image</CMButton>
            </Tooltip>
            <Tooltip title={"Click here to save your edits. The underlying image file won't be modified but the edits will be updated for the public homepage. Do this if you didn't perform any cropping, or if you are just tweaking the image a little bit. Avoids creating a new image file."}>
                <CMButton disabled={pending} onClick={handleSaveRotationClick} className={`toolbutton save`}>{gIconMap.Save()} Save edits</CMButton>
            </Tooltip>
            <CMButton disabled={pending} onClick={props.onExitEditMode} startIcon={gIconMap.Edit()}>Close</CMButton>
        </CMButtonGroup>
        <JoystickDiv
            enabled={!pending}
            onDragMove={handleDragMove}
        >
            <HomepageMain
                presentation={dashboard.memberPresentation}
                content={content}
                fullPage={false}
                className="embeddedPreview"
                lang={lang}
                onLangChange={setLang}
                editable={true}
                additionalAgendaChildren={
                    <>
                        <div>
                            {editingValue.file.fileLeafName}<br />

                            {editingValue.file.storedLeafName}
                            ({info.fileDimensions.width.toFixed(0)} x {info.fileDimensions.height.toFixed(0)})
                            - {formatFileSize(editingValue.file.sizeBytes || 0)}<br />

                            crop: [{info.cropBegin.x.toFixed(0)},{info.cropBegin.y.toFixed(0)}]-[{info.cropEnd.x.toFixed(0)},{info.cropEnd.y.toFixed(0)}]
                            {(croppedSizeP * 100).toFixed(0)}%
                            ({info.cropSize.width.toFixed(0)} x {info.cropSize.height.toFixed(0)})
                            {formatFileSize((editingValue.file.sizeBytes || 0) * croppedSizeP)}
                            <br />

                            optimized: ({reducedDimensions.width.toFixed(0)} x {reducedDimensions.height.toFixed(0)})
                            {(reducedSizeP * 100).toFixed(0)}%, {formatFileSize((editingValue.file.sizeBytes || 0) * reducedSizeP)}
                            <br />
                            rotate: {info.displayParams.rotate.toFixed(2)} deg
                        </div>
                    </>
                }
            />
        </JoystickDiv>

    </div>);
};

export interface GalleryItemImageControlProps {
    value: FrontpageGalleryItemClient;
    client: FrontpageGalleryClient;
    editMode: boolean;
    setEditMode: (newValue: boolean) => void;
};
export const GalleryItemImageControl = (props: GalleryItemImageControlProps) => {
    const cmdbRouter = useCmdbRouter();


    return props.editMode ? (
        <GalleryItemImageEditControl client={props.client} value={props.value} onExitEditMode={() => props.setEditMode(false)} />
    ) : (
        <div className="imageEditControlContainer">
            <img src={cmdbRouter.getURIForFile(props.value.file)} style={{ maxWidth: 200, maxHeight: 150 }} />
        </div>
    );
};
interface GalleryItemProps {
    value: FrontpageGalleryItemClient;
    client: FrontpageGalleryClient;
};

const GalleryItem = (props: GalleryItemProps) => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const [showingDeleteConfirmation, setShowingDeleteConfirmation] = React.useState<boolean>(false);
    const [imageEditMode, setImageEditMode] = React.useState<boolean>(false);
    const [descriptionEditMode, setDescriptionEditMode] = React.useState<boolean>(false);
    const recordFeature = useFeatureRecorder();

    const handleSoftDeleteClick = () => {
        const newrow: FrontpageGalleryItemClient = { ...props.value, isDeleted: true };
        void recordFeature({
            feature: ActivityFeature.frontpagegallery_item_delete,
            frontpageGalleryItemId: newrow.publicId,
        });
        props.client.crud.update(newrow, props.value).then(() => {
            showSnackbar({ severity: "success", children: `item soft-deleted.` });
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: `error deleting: ${e}` });
        }).finally(() => {
            props.client.refetch();
        });
    };

    const handleVisibilityChange = (visiblePermission: VisibilityControlValue) => {
        const newrow: FrontpageGalleryItemClient = {
            ...props.value,
            visiblePermission,
            visiblePermissionId: visiblePermission
                ? db3.xPermission.getIdentity(visiblePermission)
                : null,
        };
        void recordFeature({
            feature: ActivityFeature.frontpagegallery_item_change_visibility,
            frontpageGalleryItemId: newrow.publicId,
        });
        props.client.crud.update(newrow, props.value).then(() => {
            showSnackbar({ severity: "success", children: `Visibility updated.` });
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: `error updating visibility: ${e}` });
        }).finally(() => {
            props.client.refetch();
        });
    };

    const largeFile = (props.value.file.sizeBytes || 0) > 1000000;

    return <CMSinglePageSurfaceCard className="GalleryItem">
        <div className="header">
            <div className="dragHandle draggable">☰ #{props.value.sortOrder + 1}
                <span style={{ marginLeft: "12px" }}>{props.value.file.fileLeafName}</span>

            </div>
            <VisibilityControl value={props.value.visiblePermission} onChange={handleVisibilityChange} />
            <CMButton onClick={() => setShowingDeleteConfirmation(true)} startIcon={gIconMap.Delete()}>Delete</CMButton>


            {showingDeleteConfirmation && (<div className="deleteConfirmationControl">Are you sure you want to delete this item?
                <CMButton onClick={() => setShowingDeleteConfirmation(false)}>nope, cancel</CMButton>
                <CMButton onClick={() => { setShowingDeleteConfirmation(false); handleSoftDeleteClick(); }}>yes</CMButton>
            </div>)}

        </div>
        <div className="content">
            {props.value.file.sizeBytes && <div className={`filesize ${largeFile && "largeFileWarn"}`}>
                <div>{formatFileSize(props.value.file.sizeBytes)}</div>
                <div>{largeFile && "Big file warning: Consider baking a new one with web-friendly dimensions & compression factor."}</div>
            </div>}
            <GalleryItemImageControl value={props.value} client={props.client} editMode={imageEditMode} setEditMode={setImageEditMode} />
            <GalleryItemDescriptionControl value={props.value} client={props.client} editMode={descriptionEditMode} setEditMode={setDescriptionEditMode} />

            <CMButtonGroup>
                <CMButton style={{ whiteSpace: "nowrap" }} onClick={() => setImageEditMode(true)} startIcon={gIconMap.Edit()}>Edit image</CMButton>
                <CMButton style={{ whiteSpace: "nowrap" }} onClick={() => setDescriptionEditMode(true)} startIcon={gIconMap.Edit()}>Edit description</CMButton>
            </CMButtonGroup>
        </div>
    </CMSinglePageSurfaceCard>;
};
const MainContent = () => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const recordFeature = useFeatureRecorder();
    const reorderCommand = DB3Client.useDB3Command(db3.reorderGalleryItemsCommand);

    const tableSpec = DB3Client.defineTableClientSpec({ view: db3.frontpageGalleryItemEditorView, columns: galleryColumnSelection });

    const client = DB3Client.useCrudTableRenderContext({
        view: db3.frontpageGalleryItemEditorView,
        tableSpec,
    });
    const items = client.items;

    const onDrop = (args: ReactSmoothDnd.DropResult) => {
        if (args.addedIndex === args.removedIndex) {
            return;
        } // no change
        if (args.addedIndex == null || args.removedIndex == null) {
            return;
        }
        const movingItem = items[args.removedIndex];
        const newPositionItem = items[args.addedIndex];
        assert(!!movingItem && !!newPositionItem, "moving item not found?");

        void recordFeature({
            feature: ActivityFeature.frontpagegallery_reorder,
            frontpageGalleryItemId: movingItem.publicId,
        });

        reorderCommand.invoke({
            movingItemId: movingItem.publicId,
            newPositionItemId: newPositionItem.publicId,
            scopeRowIds: items.map(item => item.publicId),
        }).then(() => {
            showSnackbar({ severity: "success", children: "Gallery reorder successful" });
            client.refetch();
        }).catch((e) => {
            console.log(e);
            showSnackbar({ severity: "error", children: "reorder error; see console" });
        });
    };

    return <>
        <BandLocalizedMarkdown id="frontpage_gallery_markdown" />
        <NewGalleryItemComponent client={client} />

        <ReactSmoothDndContainer
            dragHandleSelector=".dragHandle"
            lockAxis="y"
            onDrop={onDrop}
        >
            {items.length < 1 ? "Nothing here!" : items.map(i =>
                <ReactSmoothDndDraggable key={i.publicId}>
                    <GalleryItem value={i} client={client} />
                </ReactSmoothDndDraggable>)
            }
        </ReactSmoothDndContainer>
    </>;
};


const EditFrontpageGalleryPage: BlitzPage = () => {
    const context = useDB3QueryContext();
    return (
        <DashboardLayout title="Frontpage gallery">
            <AppContextMarker name="FrontpageGalleryPage">
                <MainContent key={`${context.bandPublicId}:${context.routeLocale}`} />
            </AppContextMarker>
        </DashboardLayout>
    )
}

defineCmdbPage("bandFrontpagegallery", EditFrontpageGalleryPage);
export default EditFrontpageGalleryPage;
