import { Collapse, Tooltip } from "@mui/material";
import React from "react";
import { Permission } from 'shared/permissions';
import { IsNullOrWhitespace, parseMimeType } from 'shared/utils';
import { gCharMap } from '../../db3/components/IconMap';
import { CMDBUploadFile } from '../CMDBUploadFile';
import { useDashboardContext, useFeatureRecorder } from "../DashboardContext";
import { useSnackbar } from '../SnackbarContext';
import { Markdown } from './Markdown';
import { MarkdownCommandInvocationTriggerMap, MarkdownEditorCommand, MarkdownEditorCommandApi } from './MarkdownEditorCommandBase';
import { gMarkdownEditorCommandGroups } from './MarkdownEditorCommands';
import { MarkdownEditorFormattingTips } from './MarkdownEditorFormattingTips';
import { MarkdownLockIndicator } from './MarkdownLockIndicator';
import { MarkdownEditor } from "./RichTextEditor";
import { useControlledTextArea } from './useControlledTextArea';
import { WikiPageApi } from './useWikiPageApi';
import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";

const kMaxImageDimension = 750;

//////////////////////////////////////////////////
interface Markdown3EditorPropsBase {
    readonly?: boolean;
    value?: string;
    initialValue?: string;
    autoFocus?: boolean;
    nominalHeight: number;
    onChange: (v: string) => void;
    wikiPageApi?: WikiPageApi | null;
    startWithPreviewOpen?: boolean;
    /**
     * Optional file upload context for tagging uploaded files (e.g. song, event, instrument, user, fileTagId, etc)
     */
    uploadFileContext?: {
        taggedSongId?: number;
        taggedEventId?: number;
        taggedInstrumentId?: number;
        taggedUserId?: number;
        fileTagId?: number;
        visiblePermissionId?: number;
        visiblePermission?: string;
    };
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
    //const [contextMap, setContextMap] = React.useState<MarkdownContextMap>({});
    const commandInvocationTriggerMap = React.useRef<MarkdownCommandInvocationTriggerMap>({});
    const [totalInvokations, setTotalInvocations] = React.useState<number>(0);
    const snackbar = useSnackbar();
    const dashboardContext = useDashboardContext();
    const recordFeature = useFeatureRecorder();

    // Support for both controlled and uncontrolled usage
    const [controlledValue, setControlledValue] = React.useState<string>(props.initialValue || "");
    const weControlValue = props.initialValue !== undefined;
    const useValue = weControlValue ? controlledValue : (props.value || "");

    const handleChange = React.useCallback((newValue: string) => {
        if (weControlValue) {
            setControlledValue(newValue);
        }
        props.onChange(newValue);
    }, [weControlValue, useValue.length, props.onChange]);

    //const [textAreaRef, setTextAreaRef] = React.useState<HTMLTextAreaElement | null>(null);
    const textAreaRef = React.useRef<HTMLTextAreaElement | null>(null);
    const controlledTextArea = useControlledTextArea(textAreaRef, useValue, handleChange);
    const [nativeFileInputRef, setNativeFileInputRef] = React.useState<HTMLInputElement | null>(null);

    const makeApi = (): MarkdownEditorCommandApi => ({
        controlledTextArea,
        //contextMap,
        invocationTriggerMap: commandInvocationTriggerMap.current,
        dashboardContext: dashboardContext,
        textArea: textAreaRef.current!,
        nativeFileInputRef: nativeFileInputRef!,
        saveProgress: async () => {
            if (props.handleSave) {
                await props.handleSave();
            }
        },
    });

    const apiRef = React.useRef<MarkdownEditorCommandApi>(makeApi());

    apiRef.current = makeApi();

    const triggerInvocationMap = (command: MarkdownEditorCommand) => {
        if (commandInvocationTriggerMap.current[command.id] === undefined) {
            commandInvocationTriggerMap.current[command.id] = 0;
        }
        setTotalInvocations((prev) => prev + 1); // force a re-render to continue the invocation.
        commandInvocationTriggerMap.current[command.id]! += 1;
    };

    // ok when you upload, the gallery item component is created.
    const handleFileSelect = (files: FileList) => {
        if (!files.length) return;
        setUploadProgress(0);

        void snackbar.invokeAsync(async () => {
            void recordFeature({
                feature: ActivityFeature.file_upload,
                context: "Markdown3Editor",
            });
            const resp = await CMDBUploadFile({
                fields: {
                    ...props.uploadFileContext,
                    visiblePermission: props.uploadFileContext?.visiblePermission ?? Permission.visibility_public,
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
                const cta = apiRef.current.controlledTextArea;
                const listInfo = cta.getListAtCaretInfo();
                if (IsNullOrWhitespace(listInfo.itemText)) {
                    // no list item, so just insert a new line.
                    //cta.replaceSelectionWithText("\n", { select: "afterChange" });
                    return;
                }
                event.preventDefault();
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
                triggerInvocationMap(command);
                if (command.invoke) {
                    void command.invoke({
                        triggeredBy: "keyboard",
                        api: apiRef.current,
                    });
                }
            }
        };

        const capturedTextArea = textAreaRef.current;
        capturedTextArea && capturedTextArea.addEventListener('keydown', handleKeyDown);

        return () => {
            capturedTextArea && capturedTextArea.removeEventListener('keydown', handleKeyDown);
        };
    }, [textAreaRef]);

    // React.useEffect(() => {
    //     // find context under cursor / selection.
    //     const newContextMap: MarkdownContextMap = {};
    //     for (const command of gMarkdownEditorCommandGroups.flatMap(g => g)) {
    //         if (!command.deduceContext) continue;
    //         const context = command.deduceContext(apiRef.current);
    //         newContextMap[command.id] = context;
    //     };
    //     setContextMap(newContextMap);
    // }, [textAreaRef, props.value, controlledTextArea.selectionStart, controlledTextArea.selectionEnd]);

    if (readonly) {
        return <pre>{props.value}</pre>
    }

    return <div className="MD3 editor MD3Container">
        <div className="header">
            <div className='toolbar'>
                <div className='toolItemGroupList'>

                    {gMarkdownEditorCommandGroups.map((group, index) => <div key={index} className='toolItemGroup'>
                        {group
                            .filter(item => item.toolbarItem || item.toolbarIcon)
                            .filter(item => !item.isEnabled || item.isEnabled(apiRef.current))
                            .map((item, index) => {
                                if (item.toolbarItem) {
                                    return <React.Fragment key={index}>{item.toolbarItem({ api: apiRef.current, invocationTrigger: commandInvocationTriggerMap.current[item.id] || 0 })}</React.Fragment>;
                                }

                                return <Tooltip key={index} title={item.toolbarTooltip} disableInteractive>
                                    <div className={`toolItem interactable`} onClick={item.invoke && (async () => {
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
                    onValueChanged={handleChange}
                    onSave={props.handleSave}
                    nominalHeight={props.nominalHeight}
                    value={useValue}
                    autoFocus={autoFocus}

                    uploadProgress={uploadProgress}
                    textAreaRef={(ref) => textAreaRef.current = ref}
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
                    <Tooltip title="Save progress (Ctrl+Enter)" disableInteractive>
                        <div
                            className={`freeButton saveButton saveProgressButton ${props.hasEdits ? "changed" : "unchanged disabled"}`}
                            onClick={props.hasEdits ? async () => { await props.handleSave() } : undefined}
                        >
                            Save progress
                        </div>
                    </Tooltip>
                    <div className={`freeButton saveButton saveAndCloseButton ${props.hasEdits ? "changed" : "unchanged disabled"}`} onClick={props.hasEdits ? async () => { await props.handleSaveAndClose() } : undefined}>Save & close</div>
                </div>
            }
            {!IsNullOrWhitespace(useValue) &&
                <div className="previewContainer">
                    <div className='previewTitle freeButton' onClick={() => setShowPreview(!showPreview)}>Preview {showPreview ? gCharMap.DownTriangle() : gCharMap.UpTriangle()}</div>
                    <Collapse in={showPreview}>
                        <div className='previewMarkdownContainer hatch'>
                            <Markdown markdown={useValue} />
                        </div>
                    </Collapse>
                </div>
            }
        </div>

    </div >;
};


