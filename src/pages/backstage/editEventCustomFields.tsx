import React from 'react';
import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import * as DB3Client from "src/core/db3/DB3Client";
import { DB3EditGrid, DB3EditGridExtraActionsArgs } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { gCharMap, gIconMap } from 'src/core/db3/components/IconMap';
import { Button, ButtonGroup, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { nanoid } from 'nanoid';
import { useSnackbar } from 'src/core/components/SnackbarContext';
import { Prisma } from '@prisma/client'
import { ReactiveInputDialog, ReactSmoothDndContainer, ReactSmoothDndDraggable } from 'src/core/components/CMCoreComponents';
import * as ReactSmoothDnd /*{ Container, Draggable, DropResult }*/ from "react-smooth-dnd";
import { moveItemInArray } from 'shared/utils';
import { ColorPick } from 'src/core/components/Color';
import { gGeneralPaletteList } from 'shared/color';
import { CMTextInputBase } from 'src/core/components/CMTextField';
import { CMDialogContentText } from 'src/core/components/CMCoreComponents2';
import { Markdown3Editor } from 'src/core/components/MarkdownControl3';
import { DB3EditObject2Dialog, DB3EditObjectDialog } from 'src/core/db3/components/db3NewObjectDialog';
import { useDashboardContext } from 'src/core/components/DashboardContext';

// export type EventCustomFieldOption = {
//     label: string,
//     id: string,
//     color?: string,
// }
interface CustomFieldValueEditorProps {
    value: db3.EventCustomFieldOption;
    setValue: (val: db3.EventCustomFieldOption) => void;
};
const CustomFieldValueEditor = (props: CustomFieldValueEditorProps) => {
    return <div className='CustomFieldValueEditor'>
        <div className='dragHandle draggable'>{gCharMap.Hamburger()}</div>
        <CMTextInputBase
            value={props.value.label}
            onChange={(e, v) => props.setValue({ ...props.value, label: v })}
        />
        <ColorPick
            value={props.value.color || null}
            onChange={(color) => props.setValue({ ...props.value, color: color?.id || undefined })}
            allowNull={true}
            palettes={gGeneralPaletteList} />
    </div>;
};

const CustomFieldEditor = () => {
    const [value, setValue] = React.useState<db3.EventCustomFieldOption[]>([]);
    const [expanded, setExpanded] = React.useState<boolean>(false);
    const snackbar = useSnackbar();

    return <div className='CustomFieldEditor'>
        <div
            className={`header interactable expander ${expanded ? "expanded" : "collapsed"}`}
            onClick={() => setExpanded(!expanded)}
        >
            {!expanded ? gCharMap.UpArrow() : gCharMap.DownArrow()} Custom field options editor (not db connected; use copy/paste)
        </div>
        {expanded && <div className='expandedBody'>
            <ButtonGroup>
                <Button size='small' onClick={() => {
                    setValue([...value, {
                        id: nanoid(),
                        label: "edit me",
                    }]);
                }}>{gIconMap.Add()} Add new option</Button>
                <Button size='small' onClick={() => {
                    setValue([]);
                }}>{gIconMap.Delete()} Clear</Button>
            </ButtonGroup>
            <ButtonGroup>
                <Button size='small' onClick={async () => {
                    const text = JSON.stringify(value);
                    console.log(text);
                    await navigator.clipboard.writeText(text);
                    snackbar.showMessage({ severity: "success", children: `Copied ${text.length} characters to clipboard` });
                }}>{gIconMap.ContentCopy()} Copy</Button>
                <Button size='small' onClick={async () => {
                    const text = await navigator.clipboard.readText();
                    try {
                        const newobj = JSON.parse(text);
                        // validate the object.
                        db3.EventCustomFieldOptionArraySchema.parse(newobj);
                        setValue(newobj);
                        snackbar.showMessage({ severity: "success", children: `list successfully replaced` });
                    }
                    catch (e) {
                        console.log(e);
                        snackbar.showMessage({ severity: "error", children: "An error occurred" });
                    }
                }}>{gIconMap.ContentPaste()} Paste-replace</Button>
                <Button size='small' onClick={async () => {
                    const text = await navigator.clipboard.readText();
                    try {
                        const newobj = JSON.parse(text);
                        db3.EventCustomFieldOptionArraySchema.parse(newobj);
                        setValue([...value, ...newobj]);
                        snackbar.showMessage({ severity: "success", children: `list successfully replaced` });
                    }
                    catch (e) {
                        console.log(e);
                        snackbar.showMessage({ severity: "error", children: "An error occurred" });
                    }
                }}>{gIconMap.ContentPaste()} Paste-append</Button>
            </ButtonGroup>
            <div>

                <ReactSmoothDndContainer
                    dragHandleSelector=".dragHandle"
                    lockAxis="y"
                    onDrop={(args: ReactSmoothDnd.DropResult) => {
                        if (args.addedIndex == null || args.removedIndex == null) throw new Error(`why are these null?`);
                        //console.log(`moving ${args.removedIndex} / ${args.addedIndex}`);
                        const newval = moveItemInArray(value, args.removedIndex, args.addedIndex);
                        setValue(newval);
                    }}
                >

                    {value.map((val, i) => <ReactSmoothDndDraggable key={val.id}>
                        <CustomFieldValueEditor key={i} value={val} setValue={(val) => {
                            const n = [...value];
                            n[i] = { ...val };
                            setValue(n);
                        }} />
                    </ReactSmoothDndDraggable>)}

                </ReactSmoothDndContainer>

            </div>
            <div className='jsonPreview'>
                {JSON.stringify(value)}
            </div>
        </div>
        }
    </div>;
};

const makeEventCustomFieldClientColumns = () => [
    new DB3Client.PKColumnClient({ columnName: "id" }),
    new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 180 }),
    new DB3Client.ConstEnumStringFieldClient({ columnName: "dataType", cellWidth: 180 }),
    new DB3Client.ConstEnumStringFieldClient({ columnName: "significance", cellWidth: 180 }),
    new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 200 }),
    new DB3Client.GenericIntegerColumnClient({ columnName: "sortOrder", cellWidth: 80 }),
    new DB3Client.IconFieldClient({ columnName: "iconName", cellWidth: 120, allowNull: true }),
    new DB3Client.ColorColumnClient({ columnName: "color", cellWidth: 300 }),
    //new DB3Client.BoolColumnClient({ columnName: "isVisible" }),
    new DB3Client.GenericStringColumnClient({ columnName: "optionsJson", cellWidth: 180 }),
];

const ExtraActions = ({ gridArgs }: { gridArgs: DB3EditGridExtraActionsArgs }) => {
    const row = gridArgs.row as db3.EventCustomFieldPayload;
    const [open, setOpen] = React.useState<boolean>(false);
    const dashboardContext = useDashboardContext();
    const snackbar = useSnackbar();

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xEventCustomField,
        columns: makeEventCustomFieldClientColumns(),
    });

    return <>
        <Button onClick={() => {
            setOpen(true);
        }}>Edit in dialog</Button>
        {open && <DB3EditObjectDialog
            initialValue={row}
            onCancel={() => setOpen(false)}
            onOK={async (newValue: db3.EventCustomFieldPayload, tableRenderClient: DB3Client.xTableRenderClient) => {
                try {
                    await tableRenderClient.doUpdateMutation(newValue);
                    snackbar.showMessage({ children: "update successful", severity: 'success' });
                    setOpen(false);
                    gridArgs.refetch();
                } catch (e) {
                    console.log(e);
                    snackbar.showMessage({ children: "update error", severity: 'error' });
                }
            }}
            table={tableSpec}
            clientIntention={dashboardContext.userClientIntention}
        />}
    </>;
};

const MainContent = () => {

    const tableSpec = new DB3Client.xTableClientSpec({
        table: db3.xEventCustomField,
        columns: makeEventCustomFieldClientColumns(),
    });

    return <>
        <SettingMarkdown setting="EditEventCustomFieldsPage_markdown"></SettingMarkdown>
        <CustomFieldEditor />
        <DB3EditGrid tableSpec={tableSpec} renderExtraActions={args => <ExtraActions gridArgs={args} />} />
    </>;
};


const EditEventCustomFieldsPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Event Custom Fields" basePermission={Permission.admin_workflow_defs}>
            <MainContent />
        </DashboardLayout>
    )
}

export default EditEventCustomFieldsPage;
