// so in general we have 
// VIEW
// EDIT
// control
// all of which propagate up to a db controller

import { BlitzPage } from "@blitzjs/next";
import { Button, Checkbox, FormControlLabel, Tooltip } from "@mui/material";
import { assert } from "blitz";
import React from "react";
import * as ReactSmoothDnd /*{ Container, Draggable, DropResult }*/ from "react-smooth-dnd";
import { Permission } from "shared/permissions";
import { formatFileSize } from "shared/rootroot";
import { calculateNewDimensions, gDefaultImageArea, IsNullOrWhitespace } from "shared/utils";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { CMSinglePageSurfaceCard, JoystickDiv, ReactSmoothDndContainer, ReactSmoothDndDraggable, } from "src/core/components/CMCoreComponents";
import { KeyValueTable } from "src/core/components/CMCoreComponents2";
import { CMDBUploadFile } from "src/core/components/file/CMDBUploadFile";
import { DashboardContext, useFeatureRecorder } from "src/core/components/DashboardContext";
import { CollapsableUploadFileComponent, FileDropWrapper } from "src/core/components/file/FileDrop";
import { Markdown } from "src/core/components/markdown/Markdown";
import { Markdown3Editor } from "src/core/components/markdown/MarkdownControl3";
//import { Markdown2Control } from "src/core/components/MarkdownControl2";
import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
import { getURIForFile } from "@/src/core/db3/clientAPILL";
import { AppContextMarker } from "src/core/components/AppContext";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { VisibilityControl, VisibilityControlValue } from "src/core/components/VisibilityControl";
import { HomepageMain } from "src/core/components/homepageComponents";
import * as DB3Client from "src/core/db3/DB3Client";
import { API, HomepageContentSpec } from "src/core/db3/clientAPI";
import { gIconMap } from "src/core/db3/components/IconMap";
import * as db3 from "src/core/db3/db3";
import { Coord2D, ImageEditParams, MakeDefaultImageEditParams, MulSize, Size, UpdateGalleryItemImageParams } from "src/core/db3/shared/apiTypes";
import DashboardLayout from "@/src/core/components/dashboard/DashboardLayout";
import { SharedAPI } from "@/src/core/db3/shared/sharedAPI";



////////////////////////////////////////////////////////////////
export interface NewGalleryItemComponentProps {
    client: DB3Client.xTableRenderClient;
    showImages: boolean;
    onChangeShowImages: (newValue: boolean) => void;
};


const NewGalleryItemComponent = (props: NewGalleryItemComponentProps) => {
    const [progress, setProgress] = React.useState<number | null>(null);
    //const [showUpload, setShowUpload] = React.useState<boolean>(false);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const dashboardContext = React.useContext(DashboardContext);
    const recordFeature = useFeatureRecorder();

    const permissionId = dashboardContext.getPermission(Permission.visibility_public)!.id;// API.users.getDefaultVisibilityPermission().id;
    const currentUser = useCurrentUser()[0]!;
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: 'primary', currentUser };

    // ok when you upload, the gallery item component is created.
    const handleFileSelect = (files: FileList) => {
        if (files.length > 0) {
            setProgress(0);

            void recordFeature({
                feature: ActivityFeature.file_upload,
                context: "NewGalleryItemComponent",
            });

            CMDBUploadFile({
                fields: {
                    visiblePermissionId: permissionId,
                },
                files,
                onProgress: (prog01, uploaded, total) => {
                    //console.log(`progress:${prog}, uploaded:${uploaded}, total:${total}`);
                    setProgress(prog01);
                },
            }).then((resp) => {
                setProgress(null);
                void recordFeature({
                    feature: ActivityFeature.frontpagegallery_item_create,
                });
                const promises = resp.files.map(file => {
                    const newGalleryItem = props.client.tableSpec.args.table.createNew(clientIntention) as db3.FrontpageGalleryItemPayloadForUpload;
                    newGalleryItem.fileId = file.id;
                    newGalleryItem.file = file;
                    return props.client.doInsertMutation(newGalleryItem);
                });

                // proceed to create a gallery item.
                Promise.all(promises).then(() => {
                    showSnackbar({ severity: "success", children: `${resp.files.length} file(s) uploaded and corresponding gallery items` });
                }).catch(e => {
                    console.log(e);
                    showSnackbar({ severity: "error", children: `error creating gallery item(s) : ${e}` });
                }).finally(() => {
                    props.client.refetch();
                });

                //setProgress([...progress, `complete.`]);
            }).catch((e: string) => {
                console.log(e);
                showSnackbar({ severity: "error", children: `error uploading file(s) : ${e}` });
                //setProgress([...progress, `catch`]);
            });
        }
    };

    return <FileDropWrapper className="frontpageGalleryFileUploadWrapper" onFileSelect={handleFileSelect} onURLUpload={() => { }} progress={progress}>

        <CMSinglePageSurfaceCard className="filterControls">
            <div className="content">
                <div className="header">
                    Manage gallery items on the public homepage
                </div>

                <FormControlLabel label="Show images" control={
                    <div>
                        <div><Checkbox size="small" checked={props.showImages} onClick={() => props.onChangeShowImages(!props.showImages)} /></div>
                    </div>
                } />

                <div className="CMSidenote">
                    Images may be a big / heavy download, so they're hidden by default. This also can facilitate re-ordering.
                </div>

                <CollapsableUploadFileComponent onFileSelect={handleFileSelect} progress={progress} onURLUpload={() => { }} />
            </div>
        </CMSinglePageSurfaceCard>


    </FileDropWrapper>


};

interface GalleryItemDescriptionEditorProps {
    //initialValue: string;
    refetch: () => void;
    onClose: () => void;
    galleryItem: db3.FrontpageGalleryItemPayload;
    client: DB3Client.xTableRenderClient;
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
                frontpageGalleryItemId: props.galleryItem.id,
            });
            const newrow: db3.FrontpageGalleryItemPayload = {
                ...props.galleryItem,
                caption: valueEn || "",
                caption_fr: valueFr || "",
                caption_nl: valueNl || "",
            };
            await props.client.doUpdateMutation(newrow);
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
        props.onClose();
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
    value: db3.FrontpageGalleryItemPayload;
    client: DB3Client.xTableRenderClient;
};
export const GalleryItemDescriptionControl = (props: GalleryItemDescriptionControlProps) => {
    const [editing, setEditing] = React.useState<boolean>(false);
    return <div className='descriptionContainer'>
        {!editing && <Button onClick={() => setEditing(true)}>Edit description</Button>}
        {editing && <GalleryItemDescriptionEditor
            onClose={() => setEditing(false)}
            client={props.client}
            galleryItem={props.value}
            //initialValue={props.value.caption}
            refetch={props.client.refetch}
        />}
        <KeyValueTable data={{
            English: IsNullOrWhitespace(props.value.caption) ? <i className="placeholder">none</i> : <Markdown markdown={props.value.caption} />,
            Nederlands: IsNullOrWhitespace(props.value.caption_nl) ? <i className="placeholder">none</i> : <Markdown markdown={props.value.caption_nl} />,
            Français: IsNullOrWhitespace(props.value.caption_fr) ? <i className="placeholder">none</i> : <Markdown markdown={props.value.caption_fr} />,
        }} />
    </div>;
};











////////////////////////////////////////////////////////////////////////////////////////////////////////////////
type SelectedTool = "CropBegin" | "CropEnd" | "Move" | "Scale" | "Rotate";

// uncontrolled pattern... so upon mount, we create our own editable version of the value.
export interface GalleryItemImageEditControlProps {
    value: db3.FrontpageGalleryItemPayload;
    client: DB3Client.xTableRenderClient;
    onExitEditMode: () => void;
};
export const GalleryItemImageEditControl = (props: GalleryItemImageEditControlProps) => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const recordFeature = useFeatureRecorder();
    const updateImageMutation = API.files.updateGalleryItemImageMutation.useToken();
    const [editingValue, setEditingValue] = React.useState<db3.FrontpageGalleryItemPayloadWithAncestorFile>(() => {
        const ev: db3.FrontpageGalleryItemPayloadWithAncestorFile = { ...props.value }; // create our own copy of the item, for live editing
        let editParams: ImageEditParams = MakeDefaultImageEditParams();

        // DONT operate on parent, because it gets very confusing when trying to re-edit what was a baked file.
        // e.g. you have a huge 16mb image.
        // so you make edits and bake into a 100kb file.
        // then you want to re-edit, so you click "Edit" and imagine we're now going back to the parent so you can tweak your edits.
        // you click "Save". what now? the baked file you made will be lost, we're back to a 16mb file.
        // basically let's not turn this into a full editor.

        // if (!!props.value.file.parentFile && !!props.value.file.parentFileId) {
        //     // file has a parent. we should operate on the parent not the child which has been cropped/edited/whatev.

        //     // use the params which were used to CREATE the current file
        //     const cd = getFileCustomData(ev.file);
        //     if (cd.forkedImage) {
        //         editParams = { ...cd.forkedImage.creationEditParams };
        //     }

        //     ev.file = props.value.file.parentFile!;
        //     ev.fileId = props.value.file.parentFileId!;

        //     console.log(`grafting parent file ${ev.file.storedLeafName}`);
        // } else {
        const info = SharedAPI.files.getGalleryItemImageInfo(props.value);
        editParams = { ...info.displayParams }; // we need to adjust the file & edit params; start with a copy of existing edit params
        //}

        if (!editParams.cropSize) {// coalesce cropSize for convenience / simplicity.
            const info = SharedAPI.files.getGalleryItemImageInfo(props.value);
            editParams.cropSize = { ...info.fileDimensions };
        }
        ev.displayParams = JSON.stringify(editParams);

        return { ...ev };
    });

    //console.log(`editing file: ${editingValue.file.storedLeafName}`);

    const [selectedTool, setSelectedTool] = React.useState<SelectedTool>("Move");
    const info = SharedAPI.files.getGalleryItemImageInfo(editingValue);

    const reducedDimensions = calculateNewDimensions(info.cropSize, gDefaultImageArea);

    const setEditParams = (editParams: ImageEditParams) => {
        setEditingValue({ ...editingValue, displayParams: JSON.stringify(editParams) });
    };

    const handleSaveClick = () => {
        void recordFeature({
            feature: ActivityFeature.frontpagegallery_item_edit,
            frontpageGalleryItemId: editingValue.id,
            context: `ImageEditorBake`,
        });
        const args: UpdateGalleryItemImageParams = {
            galleryItemId: editingValue.id,
            imageParams: {
                quality: 80,
                outputType: "jpg",
                parentFileId: editingValue.fileId,
                newDimensions: { ...reducedDimensions },
                editParams: info.displayParams,
            },
        };
        updateImageMutation.invoke(args).then((r) => {
            showSnackbar({ severity: "success", children: `image updated.` });
            setEditParams({ ...r.newDisplayParams });
            props.onExitEditMode();
        }).catch((e) => {
            console.log(e);
            showSnackbar({ severity: "error", children: `error updating: ${e}` });
        }).finally(() => {
            props.client.refetch();
        });
    };

    const handleSaveRotationClick = () => {
        void recordFeature({
            feature: ActivityFeature.frontpagegallery_item_edit,
            frontpageGalleryItemId: editingValue.id,
            context: `ImageEditorSave`,
        });
        props.client.doUpdateMutation(editingValue).then((r) => {
            showSnackbar({ severity: "success", children: `params updated.` });
        }).catch((e) => {
            console.log(e);
            showSnackbar({ severity: "error", children: `error updating: ${e}` });
        }).finally(() => {
            props.client.refetch();
        });
    };

    const handleDragMove = (delta: Coord2D) => {
        switch (selectedTool) {
            case "Move": {
                const cropBegin: Coord2D = {
                    x: info.displayParams.cropBegin.x - delta.x,
                    y: info.displayParams.cropBegin.y - delta.y,
                };
                setEditParams({ ...info.displayParams, cropBegin });
                break;
            }
            case "CropBegin": {
                // the idea is to keep crop end the same.
                const cropBegin: Coord2D = {
                    x: info.displayParams.cropBegin.x + delta.x,
                    y: info.displayParams.cropBegin.y + delta.y,
                };
                const cropSize: Size = { ...info.displayParams.cropSize! };
                cropSize.width -= delta.x;
                cropSize.height -= delta.y;
                const newEditParams = { ...info.displayParams, cropBegin, cropSize };
                setEditParams(newEditParams);
                break;
            }
            case "CropEnd": {
                // the idea is to keep crop begin the same.
                const cropSize: Size = { ...info.displayParams.cropSize! };
                cropSize.width = cropSize.width + delta.x;
                cropSize.height = cropSize.height + delta.y;
                setEditParams({ ...info.displayParams, cropSize });
                break;
            }
            case "Rotate": {
                let a = info.displayParams.rotate + 0.02 * (delta.x - delta.y);
                setEditParams({ ...info.displayParams, rotate: a });
                break;
            }
            case "Scale": {
                // scale will adjust both cropbegin + cropsize, attempt to approximate a "scaling" behavior centered around the cropcenter.
                // use stuff from info because it feels more stable and predictable than using the potentially-oob values in editParams
                // the reason is that the cropbegin/cropsize is used to determine the crop center. and if it's way off in the negative this just feels awful
                const cropSize: Size = { ...info.cropSize };
                const sizeDelta = (delta.x + delta.y) * -0.001;
                const cropSizeDelta = MulSize(cropSize, sizeDelta); // abs amount to adjust size
                const cropBegin: Coord2D = {
                    x: info.cropBegin.x - cropSizeDelta.width,
                    y: info.cropBegin.y - cropSizeDelta.height,
                };
                cropSize.width += cropSizeDelta.width * 2;
                cropSize.height += cropSizeDelta.height * 2;
                setEditParams({ ...info.displayParams, cropBegin, cropSize });
                break;
            }
        };

    };

    //const internalValue: db3.FrontpageGalleryItemPayload = { ...props.value, displayParams: JSON.stringify(editParams) };

    const content: HomepageContentSpec = {
        agenda: [],
        gallery: [editingValue],
    };

    const origArea = info.fileDimensions.width * info.fileDimensions.height;
    const croppedArea = info.cropSize.width * info.cropSize.height;
    const croppedSizeP = croppedArea / origArea;
    const reducedArea = reducedDimensions.width * reducedDimensions.height;
    const reducedSizeP = reducedArea / origArea;

    const hasCroppingApplied = info.cropBegin.x !== 0 || info.cropBegin.y !== 0 || info.cropSize.width !== info.fileDimensions.width || info.cropSize.height !== info.fileDimensions.height;
    // console.log(info);
    // console.log(`hasCroppingApplied=${hasCroppingApplied}`);

    return (<div className="imageEditControlContainer ImageEditor editorMain">
        <div className="ImageEditor toolbar">
            <Button onClick={() => setSelectedTool("CropBegin")} className={`toolbutton ${selectedTool === "CropBegin" && "selected"}`}>begin</Button>
            <Button onClick={() => setSelectedTool("CropEnd")} className={`toolbutton ${selectedTool === "CropEnd" && "selected"}`}>end</Button>
            <Button onClick={() => setSelectedTool("Move")} className={`toolbutton ${selectedTool === "Move" && "selected"}`}>Move</Button>
            <Button onClick={() => setSelectedTool("Scale")} className={`toolbutton ${selectedTool === "Scale" && "selected"}`}>Scale</Button>
            <Button onClick={() => setSelectedTool("Rotate")} className={`toolbutton ${selectedTool === "Rotate" && "selected"}`}>Rotate</Button>
            <Tooltip title={"Reset edits"}>
                <Button onClick={() => {
                    setEditParams(MakeDefaultImageEditParams());
                }} className={`toolbutton resetIcon`}>⟲</Button>
            </Tooltip>
            <Tooltip title={"Click here to process the image with cropping. The idea is your crops probably result in a smaller image for more efficient page download. If you didn't crop anything don't bother with this. 'Bake' and 'Save' result in the same for public users, but bake generates a new smaller image file. Do this if you are sure you're done with edits."}>
                <span>
                    <Button onClick={handleSaveClick} className={`toolbutton save`}>{gIconMap.Save()} Bake new image</Button>
                </span>
            </Tooltip>
            <Tooltip title={"Click here to save your edits. The underlying image file won't be modified but the edits will be updated for the public homepage. Do this if you didn't perform any cropping, or if you are just tweaking the image a little bit. Avoids creating a new image file."}>
                <Button onClick={handleSaveRotationClick} className={`toolbutton save`}>{gIconMap.Save()} Save edits</Button>
            </Tooltip>
            <Button onClick={props.onExitEditMode} startIcon={gIconMap.Edit()}>Close</Button>
        </div>
        <JoystickDiv
            enabled={true}
            onDragMove={handleDragMove}
        >
            <HomepageMain
                content={content}
                fullPage={false}
                className="embeddedPreview"
                lang="en"
                onLangChange={() => { }}
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

////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export interface GalleryItemImageControlProps {
    value: db3.FrontpageGalleryItemPayload;
    client: DB3Client.xTableRenderClient;
};
export const GalleryItemImageControl = (props: GalleryItemImageControlProps) => {
    const [editMode, setEditMode] = React.useState<boolean>(false);

    return editMode ? (
        <GalleryItemImageEditControl client={props.client} value={props.value} onExitEditMode={() => setEditMode(false)} />
    ) : (
        <div className="imageEditControlContainer">
            <div className="buttonRow">
                <Button onClick={() => setEditMode(true)} startIcon={gIconMap.Edit()}>Edit image</Button>
            </div>
            <img src={getURIForFile(props.value.file)} style={{ maxWidth: 200, maxHeight: 150 }} />
        </div>
    );
};



////////////////////////////////////////////////////////////////
interface GalleryItemProps {
    value: db3.FrontpageGalleryItemPayload;
    showImages: boolean;
    client: DB3Client.xTableRenderClient;
};

const GalleryItem = (props: GalleryItemProps) => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const [showingDeleteConfirmation, setShowingDeleteConfirmation] = React.useState<boolean>(false);
    const recordFeature = useFeatureRecorder();

    const handleSoftDeleteClick = () => {
        const newrow: db3.FrontpageGalleryItemPayload = { ...props.value, isDeleted: true };
        void recordFeature({
            feature: ActivityFeature.frontpagegallery_item_delete,
            frontpageGalleryItemId: newrow.id,
        });
        props.client.doUpdateMutation(newrow).then(() => {
            showSnackbar({ severity: "success", children: `item soft-deleted.` });
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: `error deleting: ${e}` });
        }).finally(() => {
            props.client.refetch();
        });
    };

    const handleVisibilityChange = (visiblePermission: VisibilityControlValue) => {
        const newrow: db3.FrontpageGalleryItemPayload = { ...props.value, visiblePermission, visiblePermissionId: visiblePermission?.id || null };
        void recordFeature({
            feature: ActivityFeature.frontpagegallery_item_change_visibility,
            frontpageGalleryItemId: newrow.id,
        });
        props.client.doUpdateMutation(newrow).then(() => {
            // the referenced file should also assume the visibility, however that's not necessary. when viewing a file via gallery item, the file is automatically shown if the gallery item is.
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
            <div className="dragHandle draggable">☰ Order: {props.value.sortOrder}</div>
            <VisibilityControl value={props.value.visiblePermission} onChange={handleVisibilityChange} />
            <Button onClick={() => setShowingDeleteConfirmation(true)} startIcon={gIconMap.Delete()}>Delete</Button>


            {showingDeleteConfirmation && (<div className="deleteConfirmationControl">Are you sure you want to delete this item?
                <Button onClick={() => setShowingDeleteConfirmation(false)}>nope, cancel</Button>
                <Button onClick={() => { setShowingDeleteConfirmation(false); handleSoftDeleteClick(); }}>yes</Button>
            </div>)}

        </div>
        <div className="content">
            {props.value.file.sizeBytes && <div className={`filesize ${largeFile && "largeFileWarn"}`}>
                <div>{formatFileSize(props.value.file.sizeBytes)}</div>
                <div>{largeFile && "Big file warning: Consider baking a new one with web-friendly dimensions & compression factor."}</div>
            </div>}
            <GalleryItemDescriptionControl value={props.value} client={props.client} />
            {props.showImages &&
                <>
                    <GalleryItemImageControl value={props.value} client={props.client} />
                    <div>NOTE: This preview does not apply any edits you've made.</div>
                </>
            }
        </div>
    </CMSinglePageSurfaceCard>;
};


////////////////////////////////////////////////////////////////
const MainContent = () => {
    const [showImages, setShowImages] = React.useState<boolean>(false);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const recordFeature = useFeatureRecorder();
    const updateSortOrderMutation = API.other.updateGenericSortOrderMutation.useToken();
    const currentUser = useCurrentUser()[0]!;
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: 'primary', currentUser };
    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xFrontpageGalleryItem,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            // fields which are editable through db3mutation need to be specified here.
            new DB3Client.ForeignSingleFieldClient({ columnName: "file", cellWidth: 120 }),
            new DB3Client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80 }),
            new DB3Client.BoolColumnClient({ columnName: "isDeleted" }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "caption", cellWidth: 120 }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "caption_nl", cellWidth: 120 }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "caption_fr", cellWidth: 120 }),
            new DB3Client.GenericStringColumnClient({ columnName: "displayParams", cellWidth: 120 }),
            //new DB3Client.ForeignSingleFieldClient({ columnName: "createdByUser", cellWidth: 120, clientIntention: { intention: "admin", mode: "primary" } }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "visiblePermission", cellWidth: 120 }),
        ],
    });

    const client = DB3Client.useTableRenderContext({
        clientIntention,
        tableSpec,
        requestedCaps: DB3Client.xTableClientCaps.Query | DB3Client.xTableClientCaps.Mutation,
    });
    const items = client.items as db3.FrontpageGalleryItemPayload[];

    const onDrop = (args: ReactSmoothDnd.DropResult) => {
        if (args.addedIndex === args.removedIndex) return; // no change
        // removedIndex is the previous index; the original item to be moved
        // addedIndex is the new index where it should be moved to.
        if (args.addedIndex == null || args.removedIndex == null) throw new Error(`why are these null?`);
        const movingItem = items[args.removedIndex];
        const newPositionItem = items[args.addedIndex];
        assert(!!movingItem && !!newPositionItem, "moving item not found?");

        void recordFeature({
            feature: ActivityFeature.frontpagegallery_reorder,
            frontpageGalleryItemId: movingItem.id,
        });

        // be optimistic while we're refetching. if we were keeping our own state then we could, but we're displaying sort order directly from teh database so can't.
        //const newOrder = moveItemInArray(items, args.removedIndex, args.addedIndex).map((item, index) => ({ ...item, sortOrder: index }));

        updateSortOrderMutation.invoke({
            tableID: db3.xFrontpageGalleryItem.tableID,
            tableName: db3.xFrontpageGalleryItem.tableName,
            movingItemId: movingItem.id,
            newPositionItemId: newPositionItem.id,
        }).then(() => {
            showSnackbar({ severity: "success", children: "song list reorder successful" });
            client.refetch();
        }).catch((e) => {
            console.log(e);
            showSnackbar({ severity: "error", children: "reorder error; see console" });
        });
    };

    return <>
        <SettingMarkdown setting="frontpage_gallery_markdown"></SettingMarkdown>
        <NewGalleryItemComponent client={client} showImages={showImages} onChangeShowImages={setShowImages} />

        <ReactSmoothDndContainer
            dragHandleSelector=".dragHandle"
            lockAxis="y"
            onDrop={onDrop}
        >
            {items.length < 1 ? "Nothing here!" : items.map(i =>
                <ReactSmoothDndDraggable key={i.id}>
                    <GalleryItem value={i} client={client} showImages={showImages} />
                </ReactSmoothDndDraggable>)
            }
        </ReactSmoothDndContainer>
    </>;
};


const EditFrontpageGalleryPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Frontpage gallery" basePermission={Permission.edit_public_homepage}>
            <AppContextMarker name="FrontpageGalleryPage">
                <MainContent />
            </AppContextMarker>
        </DashboardLayout>
    )
}

export default EditFrontpageGalleryPage;
