import { Collapse, Tooltip } from "@mui/material";
import React from "react";
import { Permission } from 'shared/permissions';
import { IsNullOrWhitespace, parseMimeType } from 'shared/utils';
import { gCharMap } from '../../db3/components/IconMap';
import { CMDBUploadFile } from '../CMDBUploadFile';
import { useSnackbar } from '../SnackbarContext';
import { Markdown } from './Markdown';
import { MarkdownEditorCommandApi } from './MarkdownEditorCommandBase';
import { gMarkdownEditorCommandGroups } from './MarkdownEditorCommands';
import { MarkdownEditorFormattingTips } from './MarkdownEditorFormattingTips';
import { MarkdownLockIndicator } from './MarkdownLockIndicator';
import { MarkdownEditor } from "./RichTextEditor";
import { useControlledTextArea } from './useControlledTextArea';
import { WikiPageApi } from './useWikiPageApi';

const kMaxImageDimension = 750;

//////////////////////////////////////////////////
interface Markdown3EditorPropsBase {
    readonly?: boolean;
    value: string;
    autoFocus?: boolean;
    nominalHeight: number;
    onChange: (v: string) => void;
    wikiPageApi?: WikiPageApi | null;
    startWithPreviewOpen?: boolean;
};

//////////////////////////////////////////////////
type Markdown3EditorProps = (Markdown3EditorPropsBase & {
    showActionButtons?: false | undefined;
    handleSave?: () => void;
}) | (Markdown3EditorPropsBase & {
    showActionButtons: true;
    hasEdits: boolean;
    handleCancel: () => void;
    handleSaveAndClose: () => void;
    handleSave: () => void;
});


export const Markdown3Editor = ({ readonly = false, autoFocus = false, wikiPageApi = null, startWithPreviewOpen = true, ...props }: Markdown3EditorProps) => {
    const [popoverAnchorEl, setPopoverAnchorEl] = React.useState<null | HTMLElement>(null); // not sure what this was for
    const [showFormattingTips, setShowFormattingTips] = React.useState<boolean>(false);
    const [showPreview, setShowPreview] = React.useState<boolean>(startWithPreviewOpen);
    const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
    const snackbar = useSnackbar();

    const [textAreaRef, setTextAreaRef] = React.useState<HTMLTextAreaElement | null>(null);
    const controlledTextArea = useControlledTextArea(textAreaRef, props.value || "", props.onChange);
    const [nativeFileInputRef, setNativeFileInputRef] = React.useState<HTMLInputElement | null>(null);

    const makeApi = (): MarkdownEditorCommandApi => ({
        controlledTextArea,
        textArea: textAreaRef!,
        nativeFileInputRef: nativeFileInputRef!,
        saveProgress: async () => {
            if (props.handleSave) {
                await props.handleSave();
            }
        },
    });

    const apiRef = React.useRef<MarkdownEditorCommandApi>(makeApi());

    apiRef.current = makeApi();

    // ok when you upload, the gallery item component is created.
    const handleFileSelect = (files: FileList) => {
        if (!files.length) return;
        setUploadProgress(0);

        void snackbar.invokeAsync(async () => {
            const resp = await CMDBUploadFile({
                fields: {
                    visiblePermission: Permission.visibility_public,
                },
                files,
                onProgress: (prog01, uploaded, total) => {
                    setUploadProgress(prog01);
                },
                maxImageDimension: kMaxImageDimension,
            });

            setUploadProgress(null);

            const toInsert = resp.files.map(f => {
                const url = `/api/files/download/${f.storedLeafName}`; // relative url is fine.
                const mimeInfo = parseMimeType(f.mimeType);
                const isImage = mimeInfo?.type === 'image';
                if (isImage) {
                    return `![${f.fileLeafName}](${url})`;
                }
                return `[${f.fileLeafName}](${url})`;
            }).join(" ");

            void controlledTextArea.replaceSelectionWithText(toInsert, { select: "change" });

            if (!resp.isSuccess) {
                throw new Error(`Server returned unsuccessful result while uploading files`);
            }
        },
            `Uploaded file(s)`
        );
    };

    // listen for key events to invoke commands.
    React.useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.altKey) {
                event.preventDefault();
                const cta = apiRef.current.controlledTextArea;
                const listInfo = cta.getListAtCaretInfo();
                void cta.replaceSelectionWithText("\n" + listInfo.prefix);
                return;
            }

            // find a command matching this event.
            const command = gMarkdownEditorCommandGroups.flatMap(g => g).find(c => {
                if (!c.keyboardShortcutCondition) return false;
                if (c.keyboardShortcutCondition.key.toLowerCase() !== event.key.toLowerCase()) return false;
                if (c.keyboardShortcutCondition.ctrlKey !== undefined && c.keyboardShortcutCondition.ctrlKey !== event.ctrlKey) return false;
                if (c.keyboardShortcutCondition.shiftKey !== undefined && c.keyboardShortcutCondition.shiftKey !== event.shiftKey) return false;
                if (c.keyboardShortcutCondition.altKey !== undefined && c.keyboardShortcutCondition.altKey !== event.altKey) return false;
                return true;
            });

            if (command) {
                event.preventDefault();
                event.stopPropagation();
                if (command.invoke) {
                    void command.invoke({
                        triggeredBy: "keyboard",
                        api: apiRef.current,
                    });
                }
            }
        };

        const capturedTextArea = textAreaRef;
        capturedTextArea && capturedTextArea.addEventListener('keydown', handleKeyDown);

        return () => {
            capturedTextArea && capturedTextArea.removeEventListener('keydown', handleKeyDown);
        };
    }, [textAreaRef]);

    if (readonly) {
        return <pre>{props.value}</pre>
    }

    return <div className="MD3 editor MD3Container">
        <div className="header">
            <div className='toolbar'>
                <div className='toolItemGroupList'>

                    {gMarkdownEditorCommandGroups.map((group, index) => <div key={index} className='toolItemGroup'>
                        {group.filter(item => item.toolbarItem || item.toolbarIcon).map((item, index) => {
                            if (item.toolbarItem) {
                                return <React.Fragment key={index}>{item.toolbarItem({ api: apiRef.current })}</React.Fragment>;
                            }

                            return <Tooltip key={index} title={item.toolbarTooltip} disableInteractive>
                                <div className={`toolItem`} onClick={item.invoke && (async () => {
                                    await item.invoke!({
                                        triggeredBy: "toolbar",
                                        api: apiRef.current,
                                    });
                                    //
                                })}>
                                    {item.toolbarIcon}
                                </div>
                            </Tooltip>;
                        })}
                    </div>)}

                </div>

                <div className='flex-spacer' />

                <div
                    className={`tab preview freeButton ${showFormattingTips ? "selected" : "notselected"}`}
                    onClick={() => setShowFormattingTips(!showFormattingTips)}
                >
                    Formatting tips {showFormattingTips ? gCharMap.UpTriangle() : gCharMap.DownTriangle()}
                </div>
            </div>

            <MarkdownEditorFormattingTips in={showFormattingTips} />
        </div>
        <div className={`content`} ref={setPopoverAnchorEl}>
            <div className="editorContainer">
                <MarkdownEditor
                    onValueChanged={props.onChange}
                    onSave={props.handleSave}
                    nominalHeight={props.nominalHeight}
                    value={props.value}
                    autoFocus={autoFocus}

                    uploadProgress={uploadProgress}
                    textAreaRef={setTextAreaRef}
                    nativeFileInputRef={setNativeFileInputRef}
                    onFileSelect={handleFileSelect}
                    onCustomPaste={(pastedHtml) => {
                        void controlledTextArea.replaceSelectionWithText(pastedHtml, { select: "afterChange" });
                    }}
                />
            </div>
            {props.showActionButtons &&
                <div className="actionButtonsRow">
                    <div className="flex-spacer" />
                    <MarkdownLockIndicator wikiApi={wikiPageApi} />
                    <div className={`freeButton cancelButton`} onClick={props.handleCancel}>{props.hasEdits ? "Cancel" : "Close"}</div>
                    <div className={`freeButton saveButton saveProgressButton ${props.hasEdits ? "changed" : "unchanged disabled"}`} onClick={props.hasEdits ? async () => { await props.handleSave() } : undefined}>Save progress</div>
                    <div className={`freeButton saveButton saveAndCloseButton ${props.hasEdits ? "changed" : "unchanged disabled"}`} onClick={props.hasEdits ? async () => { await props.handleSaveAndClose() } : undefined}>Save & close</div>
                </div>
            }

            {!IsNullOrWhitespace(props.value) &&
                <div className="previewContainer">
                    <div className='previewTitle freeButton' onClick={() => setShowPreview(!showPreview)}>Preview {showPreview ? gCharMap.DownTriangle() : gCharMap.UpTriangle()}</div>
                    <Collapse in={showPreview}>
                        <div className='previewMarkdownContainer hatch'>
                            <Markdown markdown={props.value} />
                        </div>
                    </Collapse>
                </div>
            }
        </div>

    </div >;
};


