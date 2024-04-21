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
import { calculateNewDimensions, formatFileSize, gDefaultImageArea } from "shared/utils";
import { useAuthorization, useAuthorizationOrThrow } from "src/auth/hooks/useAuthorization";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { CMDBUploadFile, CMSinglePageSurfaceCard, JoystickDiv, ReactSmoothDndContainer, ReactSmoothDndDraggable, } from "src/core/components/CMCoreComponents";
import { MutationMarkdownControl, SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { UploadFileComponent } from "src/core/components/SongFileComponents";
import { VisibilityControl, VisibilityControlValue } from "src/core/components/VisibilityControl";
import { HomepageMain } from "src/core/components/homepageComponents";
import * as DB3Client from "src/core/db3/DB3Client";
import { API, HomepageContentSpec } from "src/core/db3/clientAPI";
import { gIconMap } from "src/core/db3/components/IconSelectDialog";
import * as db3 from "src/core/db3/db3";
import { Coord2D, ImageEditParams, MakeDefaultImageEditParams, MulSize, Size, UpdateGalleryItemImageParams, getFileCustomData } from "src/core/db3/shared/apiTypes";
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

    const canUpload = useAuthorization("FrontpageGalleryUpload", Permission.upload_files);

    return canUpload && showUpload ? (
        <CMSinglePageSurfaceCard className="GalleryNewItem GalleryItem">
            <div className="content uploadControlContainer">
                <UploadFileComponent onFileSelect={handleFileSelect} progress={progress} onURLUpload={() => { throw new Error("url uploads not supported for frontpage gallery") }} />
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

// uncontrolled pattern... so upon mount, we create our own editable version of the value.
export interface GalleryItemImageEditControlProps {
    value: db3.FrontpageGalleryItemPayload;
    client: DB3Client.xTableRenderClient;
    onExitEditMode: () => void;
};
export const GalleryItemImageEditControl = (props: GalleryItemImageEditControlProps) => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const updateImageMutation = API.files.updateGalleryItemImageMutation.useToken();
    const [editingValue, setEditingValue] = React.useState<db3.FrontpageGalleryItemPayloadWithAncestorFile>(() => {
        const ev: db3.FrontpageGalleryItemPayloadWithAncestorFile = { ...props.value }; // create our own copy of the item, for live editing
        let editParams: ImageEditParams = MakeDefaultImageEditParams();

        if (!!props.value.file.parentFile && !!props.value.file.parentFileId) {
            // file has a parent. we should operate on the parent not the child which has been cropped/edited/whatev.

            // use the params which were used to CREATE the current file
            const cd = getFileCustomData(ev.file);
            if (cd.forkedImage) {
                editParams = { ...cd.forkedImage.creationEditParams };
            }

            ev.file = props.value.file.parentFile!;
            ev.fileId = props.value.file.parentFileId!;

            console.log(`grafting parent file ${ev.file.storedLeafName}`);
        } else {
            const info = API.files.getGalleryItemImageInfo(props.value);
            editParams = { ...info.displayParams }; // we need to adjust the file & edit params; start with a copy of existing edit params
        }

        if (!editParams.cropSize) {// coalesce cropSize for convenience / simplicity.
            const info = API.files.getGalleryItemImageInfo(props.value);
            editParams.cropSize = { ...info.fileDimensions };
        }
        ev.displayParams = JSON.stringify(editParams);

        return { ...ev };
    });

    //console.log(`editing file: ${editingValue.file.storedLeafName}`);

    const [selectedTool, setSelectedTool] = React.useState<SelectedTool>("Move");
    const info = API.files.getGalleryItemImageInfo(editingValue);

    const reducedDimensions = calculateNewDimensions(info.cropSize, gDefaultImageArea);

    const setEditParams = (editParams: ImageEditParams) => {
        setEditingValue({ ...editingValue, displayParams: JSON.stringify(editParams) });
    };

    const handleSaveClick = () => {
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
        }).catch((e) => {
            console.log(e);
            showSnackbar({ severity: "error", children: `error updating: ${e}` });
        }).finally(() => {
            props.client.refetch();
        });
    };

    const handleSaveRotationClick = () => {
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
                    <Button disabled={!hasCroppingApplied} onClick={handleSaveClick} className={`toolbutton save`}>{gIconMap.Save()} Bake new image</Button>
                </span>
            </Tooltip>
            <Tooltip title={"Click here to save your edits. The underlying image file won't be modified but the edits will be updated for the public homepage. Do this if you didn't perform any cropping, or if you are just tweaking the image a little bit. Avoids creating a new image file."}>
                <Button onClick={handleSaveRotationClick} className={`toolbutton save`}>{gIconMap.Save()} Save edits</Button>
            </Tooltip>
            <Button onClick={props.onExitEditMode} startIcon={gIconMap.Edit()}>Cancel</Button>
        </div>
        <JoystickDiv
            enabled={true}
            onDragMove={handleDragMove}
        >
            <HomepageMain
                content={content}
                fullPage={false}
                className="embeddedPreview"
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
            <img src={API.files.getURIForFile(props.value.file)} style={{ maxWidth: 200, maxHeight: 150 }} />
        </div>
    );
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

    useAuthorizationOrThrow("front page gallery", Permission.edit_public_homepage);

    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
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
        <SettingMarkdown setting="frontpage_gallery_markdown"></SettingMarkdown>
        <NewGalleryItemComponent client={client} />

        <ReactSmoothDndContainer
            dragHandleSelector=".dragHandle"
            lockAxis="y"
            onDrop={onDrop}
        >
            {items.length < 1 ? "Nothing here!" : items.map(i =>
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
