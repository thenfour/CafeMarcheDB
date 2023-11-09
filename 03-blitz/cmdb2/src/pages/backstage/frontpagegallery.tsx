// so in general we have 
// VIEW
// EDIT
// control
// all of which propagate up to a db controller

import { BlitzPage } from "@blitzjs/next";
import { Button } from "@mui/material";
import { assert } from "blitz";
import React from "react";
import * as ReactSmoothDnd /*{ Container, Draggable, DropResult }*/ from "react-smooth-dnd";
import { useCurrentUser } from "src/auth/hooks/useCurrentUser";
import { CMDBUploadFile, CMSinglePageSurfaceCard, ReactSmoothDndContainer, ReactSmoothDndDraggable, VisibilityControl, VisibilityControlValue } from "src/core/components/CMCoreComponents";
import { UploadFileComponent } from "src/core/components/EventFileComponents";
import { MutationMarkdownControl, SettingMarkdown } from "src/core/components/SettingMarkdown";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import * as DB3Client from "src/core/db3/DB3Client";
import { API } from "src/core/db3/clientAPI";
import { gIconMap } from "src/core/db3/components/IconSelectDialog";
import * as db3 from "src/core/db3/db3";
import DashboardLayout from "src/core/layouts/DashboardLayout";




////////////////////////////////////////////////////////////////
export interface NewGalleryItemComponentProps {
    client: DB3Client.xTableRenderClient;
};


const NewGalleryItemComponent = (props: NewGalleryItemComponentProps) => {
    const [progress, setProgress] = React.useState<number | null>(null);
    const [showUpload, setShowUpload] = React.useState<boolean>(false);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const permissionId = API.users.getDefaultVisibilityPermission().id;
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
    return showUpload ? (<div className="uploadControlContainer">
        <UploadFileComponent onFileSelect={handleFileSelect} progress={progress} />
        <Button onClick={() => setShowUpload(false)}>Cancel</Button>
    </div>) : (
        <Button onClick={() => setShowUpload(true)}>Upload</Button>
    );
};




////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export interface GalleryItemDescriptionControlProps {
    value: db3.FrontpageGalleryItemPayload;
    client: DB3Client.xTableRenderClient;
};
export const GalleryItemDescriptionControl = (props: GalleryItemDescriptionControlProps) => {
    //const mutationToken = API.events.updateEventBasicFields.useToken();
    return <MutationMarkdownControl
        initialValue={props.value.caption}
        refetch={props.client.refetch}
        onChange={(newValue) => {
            const newrow: db3.FrontpageGalleryItemPayload = { ...props.value, caption: newValue || "" };
            return props.client.doUpdateMutation(newrow);
        }}
    />;
};




////////////////////////////////////////////////////////////////
interface GalleryItemProps {
    value: db3.FrontpageGalleryItemPayload;
    client: DB3Client.xTableRenderClient;
};

const GalleryItem = (props: GalleryItemProps) => {
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    //const [editMode, setEditMode] = React.useState<boolean>(false);

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
            showSnackbar({ severity: "success", children: `Visibility updated.` });
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: `error updating visibility: ${e}` });
        }).finally(() => {
            props.client.refetch();
        });
    };

    return <div className="GalleryItemControl">
        <div className="dragHandle draggable">☰</div>
        <GalleryItemDescriptionControl value={props.value} client={props.client} />
        <Button onClick={handleSoftDeleteClick} startIcon={gIconMap.Delete()}>soft Delete</Button>
        <VisibilityControl value={props.value.visiblePermission} onChange={handleVisibilityChange} />
        <img src={API.files.getURIForFile(props.value.file)} style={{ maxWidth: 150, maxHeight: 150 }} />
    </div>;
    ;
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
    //console.log(client.remainingQueryStatus);

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
            showSnackbar({ severity: "success", children: "song list delete successful" });
            client.refetch();
        }).catch((e) => {
            console.log(e);
            showSnackbar({ severity: "error", children: "Error; see console" });
        });
    };

    return <>
        <SettingMarkdown settingName="frontpage_gallery_markdown"></SettingMarkdown>
        <CMSinglePageSurfaceCard>
            <div className="content">
                <NewGalleryItemComponent client={client} />
            </div>
        </CMSinglePageSurfaceCard>

        <ReactSmoothDndContainer
            dragHandleSelector=".dragHandle"
            lockAxis="y"
            onDrop={onDrop}
        >
            {items.map(i =>
                <ReactSmoothDndDraggable key={i.id}>
                    <CMSinglePageSurfaceCard>
                        <div className="content">
                            <GalleryItem value={i} client={client} />
                        </div>
                    </CMSinglePageSurfaceCard>
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
