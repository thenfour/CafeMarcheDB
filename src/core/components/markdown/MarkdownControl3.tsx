import { Collapse, Tooltip } from "@mui/material";
import CloseFullscreenIcon from "@mui/icons-material/CloseFullscreen";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import TabIcon from "@mui/icons-material/Tab";
import ViewAgendaIcon from "@mui/icons-material/ViewAgenda";
import ViewWeekIcon from "@mui/icons-material/ViewWeek";
import React from "react";
import { createPortal } from "react-dom";
import { Permission } from 'shared/permissions';
import { IsNullOrWhitespace, parseMimeType } from 'shared/utils';
import { gCharMap } from '../../db3/components/IconMap';
import { CMDBUploadFile } from '../file/CMDBUploadFile';
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
import { useDashboardContext, useFeatureRecorder } from "../dashboardContext/DashboardContext";
import { useLocalStorageState } from "../useLocalStorageState";

const kMaxImageDimension = 750;
const kFullscreenSideBySideBreakpointQuery = "(min-width: 1200px)";

type MarkdownPreviewLayout = "stacked" | "side-by-side" | "tabbed";

const kMarkdownPreviewLayouts: readonly MarkdownPreviewLayout[] = [
    "stacked",
    "side-by-side",
    "tabbed",
] as const;

const getNextMarkdownPreviewLayout = (current: MarkdownPreviewLayout): MarkdownPreviewLayout => {
    const index = kMarkdownPreviewLayouts.indexOf(current);
    const nextIndex = (index + 1) % kMarkdownPreviewLayouts.length;
    return kMarkdownPreviewLayouts[nextIndex]!;
};

const describeMarkdownPreviewLayout = (layout: MarkdownPreviewLayout): string => {
    switch (layout) {
        case "side-by-side":
            return "Side by side";
        case "tabbed":
            return "Tabbed";
        default:
            return "Stacked";
    }
};

const renderMarkdownPreviewLayoutIcon = (layout: MarkdownPreviewLayout) => {
    switch (layout) {
        case "side-by-side":
            return <ViewWeekIcon fontSize="small" />;
        case "tabbed":
            return <TabIcon fontSize="small" />;
        default:
            return <ViewAgendaIcon fontSize="small" />;
    }
};

//////////////////////////////////////////////////
interface Markdown3EditorPropsBase {
    readonly?: boolean;
    value?: string;
    initialValue?: string;
    autoFocus?: boolean;
    nominalHeight: number;
    autoSizeFromInitialValue?: boolean;
    onChange: (v: string) => void;
    wikiPageApi?: WikiPageApi | null;
    startWithPreviewOpen?: boolean;
    markdownPreviewLayout?: MarkdownPreviewLayout;
    /**
     * Optional file upload context for tagging uploaded files (e.g. song, event, instrument, user, fileTagId, etc)
     */
    uploadFileContext?: {
        taggedSongId?: number;
        taggedEventId?: number;
        taggedInstrumentId?: number;
        taggedWikiPageId?: number;
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
    const [previewLayout, setPreviewLayout] = useLocalStorageState<MarkdownPreviewLayout>({
        key: "MarkdownEditor_PreviewLayout",
        initialValue: props.markdownPreviewLayout ?? "stacked",
    });

    const nextPreviewLayout = React.useMemo(() => getNextMarkdownPreviewLayout(previewLayout), [previewLayout]);
    const currentLayoutLabel = React.useMemo(() => describeMarkdownPreviewLayout(previewLayout), [previewLayout]);
    const nextLayoutLabel = React.useMemo(() => describeMarkdownPreviewLayout(nextPreviewLayout), [nextPreviewLayout]);
    const [activeEditorTab, setActiveEditorTab] = React.useState<"write" | "preview">(startWithPreviewOpen ? "preview" : "write");
    const [isFullscreen, setIsFullscreen] = React.useState<boolean>(false);
    const [isFullscreenBreakpointMatch, setIsFullscreenBreakpointMatch] = React.useState<boolean>(false);
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
    const instanceId = React.useId();
    const writeTabId = `${instanceId}-write-tab`;
    const previewTabId = `${instanceId}-preview-tab`;
    const writePanelId = `${instanceId}-write-panel`;
    const previewPanelId = `${instanceId}-preview-panel`;
    const fullscreenButtonRef = React.useRef<HTMLButtonElement | null>(null);

    const handleLayoutChange = React.useCallback((layout: MarkdownPreviewLayout) => {
        if (layout === previewLayout) return;

        if (layout === "tabbed") {
            setActiveEditorTab(showPreview ? "preview" : "write");
            setShowPreview(true);
        } else {
            if (previewLayout === "tabbed") {
                setShowPreview(activeEditorTab === "preview");
            }
            if (layout === "side-by-side") {
                setShowPreview(true);
            }
        }

        setPreviewLayout(layout);
    }, [previewLayout, showPreview, activeEditorTab]);

    const lastForcedLayoutRef = React.useRef<MarkdownPreviewLayout | undefined>(props.markdownPreviewLayout);

    React.useEffect(() => {
        if (props.markdownPreviewLayout === undefined) return;
        if (lastForcedLayoutRef.current === props.markdownPreviewLayout) return;
        lastForcedLayoutRef.current = props.markdownPreviewLayout;
        setPreviewLayout(props.markdownPreviewLayout);
    }, [props.markdownPreviewLayout, setPreviewLayout]);

    const portalTarget = typeof window !== "undefined" ? window.document.body : null;

    React.useEffect(() => {
        if (!portalTarget) return;
        const originalOverflow = portalTarget.style.overflow;
        if (isFullscreen) {
            portalTarget.style.overflow = "hidden";
            return () => {
                portalTarget.style.overflow = originalOverflow;
            };
        }
        portalTarget.style.overflow = originalOverflow;
    }, [isFullscreen, portalTarget]);

    const wasFullscreenRef = React.useRef<boolean>(false);
    React.useEffect(() => {
        if (wasFullscreenRef.current && !isFullscreen && fullscreenButtonRef.current) {
            fullscreenButtonRef.current.focus({ preventScroll: true });
        }
        wasFullscreenRef.current = isFullscreen;
    }, [isFullscreen]);

    const handleToggleFullscreen = React.useCallback(() => {
        setIsFullscreen(prev => !prev);
    }, []);

    React.useEffect(() => {
        if (typeof window === "undefined") return;
        const mq = window.matchMedia(kFullscreenSideBySideBreakpointQuery);
        const updateMatch = () => setIsFullscreenBreakpointMatch(mq.matches);
        updateMatch();
        if (mq.addEventListener) {
            mq.addEventListener("change", updateMatch);
            return () => mq.removeEventListener("change", updateMatch);
        } else {
            mq.addListener(updateMatch);
            return () => mq.removeListener(updateMatch);
        }
    }, []);

    const autoSizeFromInitialValue = props.autoSizeFromInitialValue ?? true;

    const estimateHeightForText = React.useCallback((text: string | undefined, fallback: number) => {
        if (!text) return fallback;
        const lineHeightPx = 22;
        const lineCount = text.split(/\r?\n/).length;
        return Math.max(fallback, lineCount * lineHeightPx);
    }, []);

    const nominalHeightRef = React.useRef<number>();
    if (nominalHeightRef.current === undefined) {
        if (autoSizeFromInitialValue) {
            const seedText = props.initialValue ?? props.value;
            nominalHeightRef.current = estimateHeightForText(seedText, props.nominalHeight);
        } else {
            nominalHeightRef.current = props.nominalHeight;
        }
    }

    const effectiveNominalHeight = nominalHeightRef.current ?? props.nominalHeight;

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

    const isForcedFullscreenSideBySide = isFullscreen && previewLayout !== "tabbed" && isFullscreenBreakpointMatch;
    const effectivePreviewLayout: MarkdownPreviewLayout = isForcedFullscreenSideBySide ? "side-by-side" : previewLayout;
    const isTabbed = effectivePreviewLayout === "tabbed";
    const isSideBySide = effectivePreviewLayout === "side-by-side";
    const hasPreviewContent = !IsNullOrWhitespace(useValue);
    const allowPreview = isTabbed ? true : hasPreviewContent;
    const layoutClassName = isSideBySide ? "sideBySide" : isTabbed ? "tabbed" : "stacked";

    React.useEffect(() => {
        if (isForcedFullscreenSideBySide && !showPreview) {
            setShowPreview(true);
        }
    }, [isForcedFullscreenSideBySide, showPreview]);

    const renderEditorShell = (inFullscreen: boolean) => (
        <div className={`MD3 editor MD3Container${inFullscreen ? " fullscreen" : ""}`}>
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

                    <Tooltip title={`Switch to ${nextLayoutLabel} layout`} disableInteractive>
                        <button
                            type="button"
                            className={`toolItem interactable layoutToggleButton`}
                            onClick={() => handleLayoutChange(nextPreviewLayout)}
                            aria-label={`Current layout ${currentLayoutLabel}. Switch to ${nextLayoutLabel}`}
                        >
                            {renderMarkdownPreviewLayoutIcon(previewLayout)}
                        </button>
                    </Tooltip>

                    <Tooltip title={isFullscreen ? "Exit full screen" : "Full screen"} disableInteractive>
                        <button
                            type="button"
                            className={`toolItem interactable fullscreenToggleButton ${isFullscreen ? "selected" : ""}`}
                            onClick={handleToggleFullscreen}
                            aria-pressed={isFullscreen}
                            ref={fullscreenButtonRef}
                        >
                            {isFullscreen ? <CloseFullscreenIcon fontSize="small" /> : <OpenInFullIcon fontSize="small" />}
                        </button>
                    </Tooltip>

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
                <div className={`editorPreviewWrapper ${layoutClassName}`}>
                    {isTabbed ? (
                        <>
                            <div className="tabbedLayoutTabs" role="tablist" aria-label="Markdown editor tabs">
                                <div
                                    className={`tabbedTabButton interactable ${activeEditorTab === "write" ? "selected" : ""}`}
                                    onClick={() => setActiveEditorTab("write")}
                                    role="tab"
                                    aria-selected={activeEditorTab === "write"}
                                    aria-controls={writePanelId}
                                    id={writeTabId}
                                >
                                    Write
                                </div>
                                <div
                                    className={`tabbedTabButton interactable ${activeEditorTab === "preview" ? "selected" : ""}`}
                                    onClick={() => setActiveEditorTab("preview")}
                                    role="tab"
                                    aria-selected={activeEditorTab === "preview"}
                                    aria-controls={previewPanelId}
                                    id={previewTabId}
                                >
                                    Preview
                                </div>
                            </div>
                            <div className="tabbedLayoutPanels">
                                <div
                                    className={`tabbedPanel ${activeEditorTab === "write" ? "active" : "inactive"}`}
                                    role="tabpanel"
                                    id={writePanelId}
                                    aria-labelledby={writeTabId}
                                    hidden={activeEditorTab !== "write"}
                                >
                                    <div className="editorContainer">
                                        <MarkdownEditor
                                            onValueChanged={handleChange}
                                            onSave={props.handleSave}
                                            nominalHeight={effectiveNominalHeight}
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
                                </div>
                                <div
                                    className={`tabbedPanel ${activeEditorTab === "preview" ? "active" : "inactive"}`}
                                    role="tabpanel"
                                    id={previewPanelId}
                                    aria-labelledby={previewTabId}
                                    hidden={activeEditorTab !== "preview"}
                                >
                                    <div className="previewContainer tabbed">
                                        <div className='previewMarkdownContainer hatch'>
                                            {hasPreviewContent ? <Markdown markdown={useValue} /> : <div className='previewEmptyState'>
                                                &nbsp;
                                            </div>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="editorContainer">
                                <MarkdownEditor
                                    onValueChanged={handleChange}
                                    onSave={props.handleSave}
                                    nominalHeight={effectiveNominalHeight}
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
                            {allowPreview && (
                                <div className={`previewContainer ${isSideBySide ? "sideBySide" : "stacked"}`}>
                                    {!isSideBySide &&
                                        <div className='previewTitle freeButton' onClick={() => setShowPreview(!showPreview)}>Preview {showPreview ? gCharMap.DownTriangle() : gCharMap.UpTriangle()}</div>
                                    }
                                    {isSideBySide
                                        ? <div className='previewMarkdownContainer hatch'>
                                            <Markdown markdown={useValue} />
                                        </div>
                                        : <Collapse in={showPreview}>
                                            <div className='previewMarkdownContainer hatch'>
                                                <Markdown markdown={useValue} />
                                            </div>
                                        </Collapse>
                                    }
                                </div>
                            )}
                        </>
                    )}
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
            </div>

        </div >
    );

    if (readonly) {
        return <pre>{props.value}</pre>
    }

    if (isFullscreen && portalTarget) {
        return createPortal(
            <div className="MD3FullscreenOverlay" role="dialog" aria-modal="true">
                {renderEditorShell(true)}
            </div>,
            portalTarget
        );
    }

    if (isFullscreen) {
        return renderEditorShell(true);
    }

    return renderEditorShell(false);
};


