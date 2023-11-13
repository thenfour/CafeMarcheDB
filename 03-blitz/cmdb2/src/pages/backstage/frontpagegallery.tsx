// so in general we have 
// VIEW
// EDIT
// control
// all of which propagate up to a db controller

import { BlitzPage } from "@blitzjs/next";
import { Button, Tooltip } from "@mui/material";
import { assert } from "blitz";
import React from "react";
import * as ReactSmoothDnd /*{ Container, Draggable, DropResult }*/ from "react-smooth-dnd";
import { Permission } from "shared/permissions";
import { Clamp, calculateNewDimensions, formatFileSize, gDefaultImageArea } from "shared/utils";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { CMDBUploadFile, CMSinglePageSurfaceCard, JoystickDiv, ReactSmoothDndContainer, ReactSmoothDndDraggable, VisibilityControl, VisibilityControlValue } from "src/core/components/CMCoreComponents";
import { UploadFileComponent } from "src/core/components/EventFileComponents";
import { MutationMarkdownControl, SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { HomepageMain } from "src/core/components/homepageComponents";
import * as DB3Client from "src/core/db3/DB3Client";
import { API, HomepageContentSpec, gMinImageDimension } from "src/core/db3/clientAPI";
import { gIconMap } from "src/core/db3/components/IconSelectDialog";
import * as db3 from "src/core/db3/db3";
import { Coord2D, Coord2DToString, ImageEditParams, MakeDefaultImageEditParams, MulSize, Size, SizeToString } from "src/core/db3/shared/apiTypes";
import DashboardLayout from "src/core/layouts/DashboardLayout";



////////////////////////////////////////////////////////////////
export interface NewGalleryItemComponentProps {
    client: DB3Client.xTableRenderClient;
};


const NewGalleryItemComponent = (props: NewGalleryItemComponentProps) => {
    const [progress, setProgress] = React.useState<number | null>(null);
    const [showUpload, setShowUpload] = React.useState<boolean>(false);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const permissionId = API.users.getPermission(Permission.visibility_public)!.id;// API.users.getDefaultVisibilityPermission().id;
    const currentUser = useCurrentUser()[0]!;
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: 'primary', currentUser };

    // ok when you upload, the gallery item component is created.
    const handleFileSelect = (files: FileList) => {
        if (files.length > 0) {
            setProgress(0);
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
    return showUpload ? (
        <CMSinglePageSurfaceCard className="GalleryNewItem GalleryItem">
            <div className="content uploadControlContainer">
                <UploadFileComponent onFileSelect={handleFileSelect} progress={progress} />
                <Button onClick={() => setShowUpload(false)}>Cancel</Button>
            </div>
        </CMSinglePageSurfaceCard>
    ) : (
        <CMSinglePageSurfaceCard className="GalleryNewItem GalleryItem">
            <div className="content uploadControlContainer">
                <Button onClick={() => setShowUpload(true)}>Upload</Button>
            </div>
        </CMSinglePageSurfaceCard>
    );
};




////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface GalleryItemDescriptionControlProps {
    value: db3.FrontpageGalleryItemPayload;
    client: DB3Client.xTableRenderClient;
};
export const GalleryItemDescriptionControl = (props: GalleryItemDescriptionControlProps) => {
    return <MutationMarkdownControl
        initialValue={props.value.caption}
        editButtonText="Edit caption"
        refetch={props.client.refetch}
        onChange={(newValue) => {
            const newrow: db3.FrontpageGalleryItemPayload = { ...props.value, caption: newValue || "" };
            return props.client.doUpdateMutation(newrow);
        }}
    />;
};



////////////////////////////////////////////////////////////////////////////////////////////////////////////////
type SelectedTool = "CropBegin" | "CropEnd" | "Move" | "Scale" | "Rotate";

export interface GalleryItemImageControlProps {
    value: db3.FrontpageGalleryItemPayload;
    client: DB3Client.xTableRenderClient;
};
export const GalleryItemImageControl = (props: GalleryItemImageControlProps) => {
    const [editMode, setEditMode] = React.useState<boolean>(false);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const [editParams, setEditParams] = React.useState<ImageEditParams>(() => db3.getGalleryItemDisplayParams(props.value));
    const [selectedTool, setSelectedTool] = React.useState<SelectedTool>("Move");
    const info = API.files.getGalleryItemImageInfo(props.value, editParams);

    const enterEditMode = () => {
        // when entering edit mode, refer to the ORIGINAL image, not this one.
        // now, if we go all the way back to the root image, it means having to aggregate the ancestry of image edit params to represent direct SRC -> this.
        // that's not even close to worth it, esp. considering we're likely not going to have multiple generations.
        // likely the workflow is
        // user uploads A
        // edits and saves B ( A->B )
        // edits B which operates on parent, A.
        // so unless there are other ways to fork images, we're always going to be working with the source image.
    };

    const handleSaveClick = () => {

        // this should be done in a mutation because it's many db operations intertwined.
        // fork the image to get a new file
        // update the gallery item with new editparams + forked image file.
        //
        // delete the orphaned file if it's not referenced anywhere....
        // so the fork can be from EDITINGIMGFILE (maybe parent) -> NEWIMAGEFILE
        // and gallery item references ORIGINALIMAGEFILE -> NEWIMAGEFILE.
        // when ORIGINALIMAGEFILE gets orphaned and isn't an original, can be deleted. hm it's not so easy. maybe better to create a "clean up orphaned files" page.

        // const newrow: db3.FrontpageGalleryItemPayload = { ...props.value, isDeleted: true };
        // props.client.doUpdateMutation(newrow).then(() => {
        //     showSnackbar({ severity: "success", children: `item soft-deleted.` });
        // }).catch(e => {
        //     console.log(e);
        //     showSnackbar({ severity: "error", children: `error deleting: ${e}` });
        // }).finally(() => {
        //     props.client.refetch();
        // });
    };

    const handleDragMove = (delta: Coord2D) => {
        switch (selectedTool) {
            case "Move": {
                const cropBegin: Coord2D = {
                    x: editParams.cropBegin.x - delta.x,
                    y: editParams.cropBegin.y - delta.y,
                };
                setEditParams({ ...editParams, cropBegin });
                break;
            }
            case "CropBegin": {
                // the idea is to keep crop end the same.
                const cropBegin: Coord2D = {
                    x: Clamp(editParams.cropBegin.x + delta.x, 0, info.fileDimensions.width - gMinImageDimension),
                    y: Clamp(editParams.cropBegin.y + delta.y, 0, info.fileDimensions.height - gMinImageDimension),
                };
                const cropSize: Size = editParams.cropSize || info.cropSize;
                cropSize.width -= delta.x;
                cropSize.height -= delta.y;
                setEditParams({ ...editParams, cropBegin, cropSize });
                break;
            }
            case "CropEnd": {
                // the idea is to keep crop begin the same.
                const cropSize: Size = editParams.cropSize || info.cropSize;
                cropSize.width = cropSize.width + delta.x;
                cropSize.height = cropSize.height + delta.y;
                setEditParams({ ...editParams, cropSize });
                break;
            }
            case "Rotate": {
                let a = editParams.rotate + 0.02 * (delta.x - delta.y);
                setEditParams({ ...editParams, rotate: a });
                break;
            }
            case "Scale": {
                // scale will adjust both cropbegin + cropsize, attempt to approximate a "scaling" behavior centered around the cropcenter.
                const cropSize: Size = info.cropSize; // use stuff from info because it feels more stable and predictable than using the potentially-oob values in editParams
                const sizeDelta = (delta.x + delta.y) * -0.01;
                const cropSizeDelta = MulSize(cropSize, sizeDelta); // abs amount to adjust size
                const cropBegin: Coord2D = {
                    x: info.cropBegin.x - cropSizeDelta.width,
                    y: info.cropBegin.y - cropSizeDelta.height,
                };
                cropSize.width += cropSizeDelta.width * 2;
                cropSize.height += cropSizeDelta.height * 2;
                setEditParams({ ...editParams, cropBegin, cropSize });
                break;
            }
        };

    };

    const internalValue: db3.FrontpageGalleryItemPayload = { ...props.value, displayParams: JSON.stringify(editParams) };

    const content: HomepageContentSpec = {
        agenda: [],
        gallery: [internalValue],
    };

    const origArea = info.fileDimensions.width * info.fileDimensions.height;
    const croppedArea = info.cropSize.width * info.cropSize.height;
    const croppedSizeP = croppedArea / origArea;
    const reducedDimensions = calculateNewDimensions(info.cropSize, gDefaultImageArea);
    const reducedArea = reducedDimensions.width * reducedDimensions.height;
    const reducedSizeP = reducedArea / origArea;

    return editMode ? (<div className="imageEditControlContainer ImageEditor editorMain">
        <div className="buttonRow">
            <Button onClick={handleSaveClick} startIcon={gIconMap.Edit()}>Save</Button>
            <Button onClick={() => setEditMode(false)} startIcon={gIconMap.Edit()}>Cancel</Button>
        </div>
        <div className="ImageEditor toolbar">
            <Button onClick={() => setSelectedTool("CropBegin")} className={`toolbutton ${selectedTool === "CropBegin" && "selected"}`}>begin</Button>
            <Button onClick={() => setSelectedTool("CropEnd")} className={`toolbutton ${selectedTool === "CropEnd" && "selected"}`}>end</Button>
            <Button onClick={() => setSelectedTool("Move")} className={`toolbutton ${selectedTool === "Move" && "selected"}`}>Move</Button>
            <Button onClick={() => setSelectedTool("Scale")} className={`toolbutton ${selectedTool === "Scale" && "selected"}`}>Scale</Button>
            <Button onClick={() => setSelectedTool("Rotate")} className={`toolbutton ${selectedTool === "Rotate" && "selected"}`}>Rotate</Button>
            <Button onClick={() => {
                setEditParams(MakeDefaultImageEditParams());
                //setScale(1);
            }} className={`toolbutton resetIcon`}>⟲</Button>
            <Tooltip title={"Click here to process the image with cropping; the idea is to reduce file size by chopping out material the user won't see."}>
                <Button onClick={handleSaveClick} className={`toolbutton save`}>{gIconMap.Save()} Crop image</Button>
            </Tooltip>
            <Tooltip title={"This file is an edited form of another image. Click here to base your edits off the original image."}>
                <Button onClick={handleSaveClick} className={`toolbutton save`}>&#x2191; Use parent image</Button>
            </Tooltip>
        </div>
        <JoystickDiv
            enabled={true}
            onDragMove={handleDragMove}
        >
            <HomepageMain
                content={content}
                //rotate={rotate}
                fullPage={false}
                className="embeddedPreview"
                editable={true}
                additionalAgendaChildren={
                    <>
                        <div>
                            [{info.cropBegin.x.toFixed(0)},{info.cropBegin.y.toFixed(0)}]-[{info.cropEnd.x.toFixed(0)},{info.cropEnd.y.toFixed(0)}]
                            ({info.cropSize.width.toFixed(0)} x {info.cropSize.height.toFixed(0)})
                            or optimized: ({reducedDimensions.width.toFixed(0)} x {reducedDimensions.height.toFixed(0)})
                        </div>
                        <div>
                            {formatFileSize(props.value.file.sizeBytes)}<br />
                            (cropped: {(croppedSizeP * 100).toFixed(0)}%, {formatFileSize(props.value.file.sizeBytes * croppedSizeP)})<br />
                            (reduced: {(reducedSizeP * 100).toFixed(0)}%, {formatFileSize(props.value.file.sizeBytes * reducedSizeP)})
                        </div>
                    </>
                }
            />
        </JoystickDiv>

    </div>) : (<div className="imageEditControlContainer">
        <div className="buttonRow">
            <Button onClick={() => setEditMode(true)} startIcon={gIconMap.Edit()}>Edit image</Button>
        </div>
        <img src={API.files.getURIForFile(props.value.file)} style={{ maxWidth: 200, maxHeight: 150 }} />
    </div>);
};


////////////////////////////////////////////////////////////////
interface GalleryItemProps {
    value: db3.FrontpageGalleryItemPayload;
    client: DB3Client.xTableRenderClient;
};

const GalleryItem = (props: GalleryItemProps) => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const handleSoftDeleteClick = () => {
        const newrow: db3.FrontpageGalleryItemPayload = { ...props.value, isDeleted: true };
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

    return <CMSinglePageSurfaceCard className="GalleryItem">
        <div className="header">
            <div className="dragHandle draggable">☰ Order: {props.value.sortOrder}</div>
            <VisibilityControl value={props.value.visiblePermission} onChange={handleVisibilityChange} />
            <Button onClick={handleSoftDeleteClick} startIcon={gIconMap.Delete()}>Delete</Button>
        </div>
        <div className="content">
            <GalleryItemDescriptionControl value={props.value} client={props.client} />
            <GalleryItemImageControl value={props.value} client={props.client} />
        </div>
    </CMSinglePageSurfaceCard>;
};


////////////////////////////////////////////////////////////////
const MainContent = () => {

    // todo: authorize

    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const updateSortOrderMutation = API.other.updateGenericSortOrderMutation.useToken();
    const currentUser = useCurrentUser()[0]!;
    const clientIntention: db3.xTableClientUsageContext = { intention: "user", mode: 'primary', currentUser };
    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xFrontpageGalleryItem,
        columns: [
            new DB3Client.PKColumnClient({ columnName: "id" }),
            // fields which are editable through db3mutation need to be specified here.
            new DB3Client.ForeignSingleFieldClient({ columnName: "file", cellWidth: 120, clientIntention }),
            new DB3Client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80 }),
            new DB3Client.BoolColumnClient({ columnName: "isDeleted" }),
            new DB3Client.MarkdownStringColumnClient({ columnName: "caption", cellWidth: 120 }),
            //new DB3Client.GenericStringColumnClient({ columnName: "displayParams", cellWidth: 120 }),
            //new DB3Client.ForeignSingleFieldClient({ columnName: "createdByUser", cellWidth: 120, clientIntention: { intention: "admin", mode: "primary" } }),
            new DB3Client.ForeignSingleFieldClient({ columnName: "visiblePermission", cellWidth: 120, clientIntention }),
        ],
    });

    const client = DB3Client.useTableRenderContext({
        clientIntention,
        tableSpec,
        requestedCaps: DB3Client.xTableClientCaps.Query | DB3Client.xTableClientCaps.Mutation,
    });
    const items = client.items as db3.FrontpageGalleryItemPayload[];

    const onDrop = (args: ReactSmoothDnd.DropResult) => {
        // removedIndex is the previous index; the original item to be moved
        // addedIndex is the new index where it should be moved to.
        if (args.addedIndex == null || args.removedIndex == null) throw new Error(`why are these null?`);
        const movingItem = items[args.removedIndex];
        const newPositionItem = items[args.addedIndex];
        assert(!!movingItem && !!newPositionItem, "moving item not found?");

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
        <SettingMarkdown settingName="frontpage_gallery_markdown"></SettingMarkdown>
        <NewGalleryItemComponent client={client} />

        <ReactSmoothDndContainer
            dragHandleSelector=".dragHandle"
            lockAxis="y"
            onDrop={onDrop}
        >
            {items.map(i =>
                <ReactSmoothDndDraggable key={i.id}>
                    <GalleryItem value={i} client={client} />
                </ReactSmoothDndDraggable>)
            }
        </ReactSmoothDndContainer>
    </>;
};


const EditFrontpageGalleryPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Frontpage gallery">
            <MainContent />
        </DashboardLayout>
    )
}

export default EditFrontpageGalleryPage;
