import CloseFullscreenIcon from "@mui/icons-material/CloseFullscreen";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import TabIcon from "@mui/icons-material/Tab";
import ViewAgendaIcon from "@mui/icons-material/ViewAgenda";
import ViewWeekIcon from "@mui/icons-material/ViewWeek";
import { Collapse, Tooltip } from "@mui/material";
import React from "react";
import { Permission } from "shared/permissions";
import type { TClientUploadFileArgs } from "../../db3/shared/fileTypes";
import { IsNullOrWhitespace } from 'shared/utils';
import { gCharMap } from '../../db3/components/IconMap';
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { ResponsiveDialog } from "../ResponsiveDialog";
import { useLocalStorageState } from "../useLocalStorageState";
import { Markdown } from './Markdown';
import { MarkdownCommandInvocationTriggerMap, MarkdownEditorCommand, MarkdownEditorCommandApi } from './MarkdownEditorCommandBase';
import { gMarkdownEditorCommandGroups } from './MarkdownEditorCommands';
import { MarkdownEditorFormattingTips } from './MarkdownEditorFormattingTips';
import { MarkdownLockIndicator } from './MarkdownLockIndicator';
import { MarkdownEditor } from "./RichTextEditor";
import { useControlledTextArea } from './useControlledTextArea';
import { WikiPageApi } from './useWikiPageApi';
import { useMarkdownAttachments } from './useMarkdownAttachments';

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
    /** Disable server file uploads in local-only editors such as the attendance sandbox. */
    allowUploads?: boolean;
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
     * Public associations for uploaded files (e.g. Song, Event, instrument or band member).
     */
    uploadFileContext?: Omit<TClientUploadFileArgs, "externalURI">;
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
    const dashboardContext = useDashboardContext();
    const referenceSearchEnabled = !!dashboardContext.authorizationContext?.bandPublicId && dashboardContext.isAuthorized(Permission.login);

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
    const uploadsEnabled = !readonly && props.allowUploads !== false
        && !!dashboardContext.authorizationContext?.userPublicId
        && !!dashboardContext.authorizationContext?.bandPublicId && dashboardContext.isAuthorized(Permission.upload_files);
    // Markdown attachments retain the original public visibility and image size policy.
    const uploadFields = props.uploadFileContext?.visiblePermissionId || props.uploadFileContext?.visiblePermission
        ? props.uploadFileContext : { ...props.uploadFileContext, visiblePermission: Permission.visibility_public };
    const attachments = useMarkdownAttachments({
        enabled: uploadsEnabled, bandPublicId: dashboardContext.authorizationContext?.bandPublicId ?? null,
        fields: uploadFields, maxImageDimension: 750,
        scopeKey: JSON.stringify([dashboardContext.authorizationContext, dashboardContext.localePreferences, uploadFields]),
        draft: useValue, textarea: textAreaRef, editor: controlledTextArea,
    });
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
        nativeFileInputRef,
        allowUploads: uploadsEnabled,
        uploadInProgress: attachments.progress !== null,
        referenceSearchEnabled,
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
                                            referenceSearchEnabled={referenceSearchEnabled}
                                            uploadsEnabled={uploadsEnabled}
                                            onValueChanged={controlledTextArea.handleNativeTextChange}
                                            onBeforeInput={controlledTextArea.handleNativeBeforeInput}
                                            onSave={props.handleSave}
                                            nominalHeight={effectiveNominalHeight}
                                            value={useValue}
                                            autoFocus={autoFocus}

                                            uploadProgress={attachments.progress}
                                            textAreaRef={(ref) => textAreaRef.current = ref}
                                            nativeFileInputRef={setNativeFileInputRef}
                                            onFileSelect={attachments.onFileSelect}
                                            onURLUpload={attachments.onURLUpload}
                                            onCustomPaste={(pastedHtml) => {
                                                void controlledTextArea.replaceSelectionWithText(pastedHtml, {
                                                    select: "afterChange",
                                                    historyEditKind: "isolated",
                                                });
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
                                    referenceSearchEnabled={referenceSearchEnabled}
                                    uploadsEnabled={uploadsEnabled}
                                    onValueChanged={controlledTextArea.handleNativeTextChange}
                                    onBeforeInput={controlledTextArea.handleNativeBeforeInput}
                                    onSave={props.handleSave}
                                    nominalHeight={effectiveNominalHeight}
                                    value={useValue}
                                    autoFocus={autoFocus}

                                    uploadProgress={attachments.progress}
                                    textAreaRef={(ref) => textAreaRef.current = ref}
                                    nativeFileInputRef={setNativeFileInputRef}
                                    onFileSelect={attachments.onFileSelect}
                                    onURLUpload={attachments.onURLUpload}
                                    onCustomPaste={(pastedHtml) => {
                                        void controlledTextArea.replaceSelectionWithText(pastedHtml, {
                                            select: "afterChange",
                                            historyEditKind: "isolated",
                                        });
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

    if (isFullscreen) {
        return <ResponsiveDialog
            className="MarkdownFullscreenDialog"
            open={true}
            onClose={() => setIsFullscreen(false)}
            scroll="paper"
            maxWidth={false}
            disableRestoreFocus={true}
        >
            {renderEditorShell(true)}
        </ResponsiveDialog>;
    }

    return renderEditorShell(false);
};

// MIGRATION_RESTORE: file-creation
// Source: 1bea5a730d2f3a8c20b490681360e1c698403523:src/core/components/markdown/MarkdownControl3.tsx:1-1
// Reason: Upload and image-creation paths omit band ownership, use removed global tag/instrument models and person associations, and depend on unfinished File row contracts.
// Restore: Restore multipart/external-URL uploads, public-ID band-owned associations, automatic Partition/Recording and instrument matching, image crop/rotate/resize, metadata processing, gallery bake and generic File creation with fresh transactional authorization, filesystem cleanup and localized controls; retain download behavior.
// Verification: Reactivate image authorization specifications; verify two bands, independent grants and revocation, hidden/foreign parents and associations, inactive memberships/catalogs, multipart failures and limits, file/URL/paste/drop uploads, image transforms/metadata, rollback and storage cleanup, public DTOs and built-browser workflows.
// SHA256: 43a02e8e0314f8ec59ecafc49f2449529c75c4696fabc752b8d9b7bc64c1f39c
// MIGRATION_REFERENCE_BEGIN
// import { ActivityFeature } from "@/src/core/components/featureReports/activityTracking";
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: file-creation
// Source: 1bea5a730d2f3a8c20b490681360e1c698403523:src/core/components/markdown/MarkdownControl3.tsx:9-9
// Reason: Upload and image-creation paths omit band ownership, use removed global tag/instrument models and person associations, and depend on unfinished File row contracts.
// Restore: Restore multipart/external-URL uploads, public-ID band-owned associations, automatic Partition/Recording and instrument matching, image crop/rotate/resize, metadata processing, gallery bake and generic File creation with fresh transactional authorization, filesystem cleanup and localized controls; retain download behavior.
// Verification: Reactivate image authorization specifications; verify two bands, independent grants and revocation, hidden/foreign parents and associations, inactive memberships/catalogs, multipart failures and limits, file/URL/paste/drop uploads, image transforms/metadata, rollback and storage cleanup, public DTOs and built-browser workflows.
// SHA256: 176e897aafe67f1c709c492bf2547cc8d878b63305dcc98fd8676ce345dfe20a
// MIGRATION_REFERENCE_BEGIN
// import { Permission } from 'shared/permissions';
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: file-creation
// Source: 1bea5a730d2f3a8c20b490681360e1c698403523:src/core/components/markdown/MarkdownControl3.tsx:11-11
// Reason: Upload and image-creation paths omit band ownership, use removed global tag/instrument models and person associations, and depend on unfinished File row contracts.
// Restore: Restore multipart/external-URL uploads, public-ID band-owned associations, automatic Partition/Recording and instrument matching, image crop/rotate/resize, metadata processing, gallery bake and generic File creation with fresh transactional authorization, filesystem cleanup and localized controls; retain download behavior.
// Verification: Reactivate image authorization specifications; verify two bands, independent grants and revocation, hidden/foreign parents and associations, inactive memberships/catalogs, multipart failures and limits, file/URL/paste/drop uploads, image transforms/metadata, rollback and storage cleanup, public DTOs and built-browser workflows.
// SHA256: db3d349b2e818ebaffb998fe2b3d34168a3d17f4b95124d168886d9f4192f911
// MIGRATION_REFERENCE_BEGIN
// import { IsNullOrWhitespace, parseMimeType } from 'shared/utils';
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: file-creation
// Source: 1bea5a730d2f3a8c20b490681360e1c698403523:src/core/components/markdown/MarkdownControl3.tsx:13-16
// Reason: Upload and image-creation paths omit band ownership, use removed global tag/instrument models and person associations, and depend on unfinished File row contracts.
// Restore: Restore multipart/external-URL uploads, public-ID band-owned associations, automatic Partition/Recording and instrument matching, image crop/rotate/resize, metadata processing, gallery bake and generic File creation with fresh transactional authorization, filesystem cleanup and localized controls; retain download behavior.
// Verification: Reactivate image authorization specifications; verify two bands, independent grants and revocation, hidden/foreign parents and associations, inactive memberships/catalogs, multipart failures and limits, file/URL/paste/drop uploads, image transforms/metadata, rollback and storage cleanup, public DTOs and built-browser workflows.
// SHA256: 976ca578e0d99810771c1e309836d5ca5fee3b438b269a0cd4e93fbe5be4b581
// MIGRATION_REFERENCE_BEGIN
// import { useDashboardContext, useFeatureRecorder } from "../dashboardContext/DashboardContext";
// import { CMDBUploadFile } from '../file/CMDBUploadFile';
// import { ResponsiveDialog } from "../ResponsiveDialog";
// import { useSnackbar } from '../SnackbarContext';
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: file-creation
// Source: 1bea5a730d2f3a8c20b490681360e1c698403523:src/core/components/markdown/MarkdownControl3.tsx:27-27
// Reason: Upload and image-creation paths omit band ownership, use removed global tag/instrument models and person associations, and depend on unfinished File row contracts.
// Restore: Restore multipart/external-URL uploads, public-ID band-owned associations, automatic Partition/Recording and instrument matching, image crop/rotate/resize, metadata processing, gallery bake and generic File creation with fresh transactional authorization, filesystem cleanup and localized controls; retain download behavior.
// Verification: Reactivate image authorization specifications; verify two bands, independent grants and revocation, hidden/foreign parents and associations, inactive memberships/catalogs, multipart failures and limits, file/URL/paste/drop uploads, image transforms/metadata, rollback and storage cleanup, public DTOs and built-browser workflows.
// SHA256: 40f7ce61188f107b9ea09b0bf32c969c910d917e6a5363fb273512511c3f9c20
// MIGRATION_REFERENCE_BEGIN
// const kMaxImageDimension = 750;
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: file-creation
// Source: 1bea5a730d2f3a8c20b490681360e1c698403523:src/core/components/markdown/MarkdownControl3.tsx:112-112
// Reason: Upload and image-creation paths omit band ownership, use removed global tag/instrument models and person associations, and depend on unfinished File row contracts.
// Restore: Restore multipart/external-URL uploads, public-ID band-owned associations, automatic Partition/Recording and instrument matching, image crop/rotate/resize, metadata processing, gallery bake and generic File creation with fresh transactional authorization, filesystem cleanup and localized controls; retain download behavior.
// Verification: Reactivate image authorization specifications; verify two bands, independent grants and revocation, hidden/foreign parents and associations, inactive memberships/catalogs, multipart failures and limits, file/URL/paste/drop uploads, image transforms/metadata, rollback and storage cleanup, public DTOs and built-browser workflows.
// SHA256: 89f8e23af5cfcb376b05300db91edaef4f8def095e3cd6e5109f27a106856e74
// MIGRATION_REFERENCE_BEGIN
//     const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: file-creation
// Source: 1bea5a730d2f3a8c20b490681360e1c698403523:src/core/components/markdown/MarkdownControl3.tsx:127-127
// Reason: Upload and image-creation paths omit band ownership, use removed global tag/instrument models and person associations, and depend on unfinished File row contracts.
// Restore: Restore multipart/external-URL uploads, public-ID band-owned associations, automatic Partition/Recording and instrument matching, image crop/rotate/resize, metadata processing, gallery bake and generic File creation with fresh transactional authorization, filesystem cleanup and localized controls; retain download behavior.
// Verification: Reactivate image authorization specifications; verify two bands, independent grants and revocation, hidden/foreign parents and associations, inactive memberships/catalogs, multipart failures and limits, file/URL/paste/drop uploads, image transforms/metadata, rollback and storage cleanup, public DTOs and built-browser workflows.
// SHA256: bb230c5e04b3683b5111556c2cda222198f1e767f3c54b1d9805feadd0d8b1ee
// MIGRATION_REFERENCE_BEGIN
//     const snackbar = useSnackbar();
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: file-creation
// Source: 1bea5a730d2f3a8c20b490681360e1c698403523:src/core/components/markdown/MarkdownControl3.tsx:129-129
// Reason: Upload and image-creation paths omit band ownership, use removed global tag/instrument models and person associations, and depend on unfinished File row contracts.
// Restore: Restore multipart/external-URL uploads, public-ID band-owned associations, automatic Partition/Recording and instrument matching, image crop/rotate/resize, metadata processing, gallery bake and generic File creation with fresh transactional authorization, filesystem cleanup and localized controls; retain download behavior.
// Verification: Reactivate image authorization specifications; verify two bands, independent grants and revocation, hidden/foreign parents and associations, inactive memberships/catalogs, multipart failures and limits, file/URL/paste/drop uploads, image transforms/metadata, rollback and storage cleanup, public DTOs and built-browser workflows.
// SHA256: af4c8aff65a3ccfabf5ef44bb03122067eefef2ec1695f6ba4bc975b6c134a9d
// MIGRATION_REFERENCE_BEGIN
//     const recordFeature = useFeatureRecorder();
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: file-creation
// Source: 1bea5a730d2f3a8c20b490681360e1c698403523:src/core/components/markdown/MarkdownControl3.tsx:235-235
// Reason: Upload and image-creation paths omit band ownership, use removed global tag/instrument models and person associations, and depend on unfinished File row contracts.
// Restore: Restore multipart/external-URL uploads, public-ID band-owned associations, automatic Partition/Recording and instrument matching, image crop/rotate/resize, metadata processing, gallery bake and generic File creation with fresh transactional authorization, filesystem cleanup and localized controls; retain download behavior.
// Verification: Reactivate image authorization specifications; verify two bands, independent grants and revocation, hidden/foreign parents and associations, inactive memberships/catalogs, multipart failures and limits, file/URL/paste/drop uploads, image transforms/metadata, rollback and storage cleanup, public DTOs and built-browser workflows.
// SHA256: 4980ace7532a5bf807b3e7b1059aa3c0cf794a0d0975a2075c2139ed80007d7e
// MIGRATION_REFERENCE_BEGIN
//         allowUploads: props.allowUploads,
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: file-creation
// Source: 1bea5a730d2f3a8c20b490681360e1c698403523:src/core/components/markdown/MarkdownControl3.tsx:255-298
// Reason: Upload and image-creation paths omit band ownership, use removed global tag/instrument models and person associations, and depend on unfinished File row contracts.
// Restore: Restore multipart/external-URL uploads, public-ID band-owned associations, automatic Partition/Recording and instrument matching, image crop/rotate/resize, metadata processing, gallery bake and generic File creation with fresh transactional authorization, filesystem cleanup and localized controls; retain download behavior.
// Verification: Reactivate image authorization specifications; verify two bands, independent grants and revocation, hidden/foreign parents and associations, inactive memberships/catalogs, multipart failures and limits, file/URL/paste/drop uploads, image transforms/metadata, rollback and storage cleanup, public DTOs and built-browser workflows.
// SHA256: 9bdcc1815fb372b2d0d9bfa4d90c2bf603693b4ba126ccc437ab20f80e7a74d0
// MIGRATION_REFERENCE_BEGIN
//     // ok when you upload, the gallery item component is created.
//     const handleFileSelect = (files: FileList) => {
//         if (props.allowUploads === false || !files.length) return;
//         setUploadProgress(0);
//
//         void snackbar.invokeAsync(async () => {
//             void recordFeature({
//                 feature: ActivityFeature.file_upload,
//                 context: "Markdown3Editor",
//             });
//             const resp = await CMDBUploadFile({
//                 fields: {
//                     ...props.uploadFileContext,
//                     visiblePermission: props.uploadFileContext?.visiblePermission ?? Permission.visibility_public,
//                 },
//                 files,
//                 onProgress: (prog01, uploaded, total) => {
//                     setUploadProgress(prog01);
//                 },
//                 maxImageDimension: kMaxImageDimension,
//             });
//
//             setUploadProgress(null);
//
//             const toInsert = resp.files.map(f => {
//                 const url = `/api/files/download/${f.storedLeafName}`; // relative url is fine.
//                 const mimeInfo = parseMimeType(f.mimeType);
//                 const isImage = mimeInfo?.type === 'image';
//                 if (isImage) {
//                     return `![${f.fileLeafName}](${url})`;
//                 }
//                 return `[${f.fileLeafName}](${url})`;
//             }).join(" ");
//
//             void apiRef.current.controlledTextArea.replaceSelectionWithText(toInsert, { select: "change" });
//
//             if (!resp.isSuccess) {
//                 throw new Error(`Server returned unsuccessful result while uploading files`);
//             }
//         },
//             `Uploaded file(s)`
//         );
//     };
//
// MIGRATION_REFERENCE_END

// MIGRATION_RESTORE: file-creation
// Source: 1bea5a730d2f3a8c20b490681360e1c698403523:src/core/components/markdown/MarkdownControl3.tsx:373-373
// Reason: Upload and image-creation paths omit band ownership, use removed global tag/instrument models and person associations, and depend on unfinished File row contracts.
// Restore: Restore multipart/external-URL uploads, public-ID band-owned associations, automatic Partition/Recording and instrument matching, image crop/rotate/resize, metadata processing, gallery bake and generic File creation with fresh transactional authorization, filesystem cleanup and localized controls; retain download behavior.
// Verification: Reactivate image authorization specifications; verify two bands, independent grants and revocation, hidden/foreign parents and associations, inactive memberships/catalogs, multipart failures and limits, file/URL/paste/drop uploads, image transforms/metadata, rollback and storage cleanup, public DTOs and built-browser workflows.
// SHA256: 5d4e5a5205e85a7c1eeb7a28bb03dce9401015f47c46cb3f5e628e2ff854912c
// MIGRATION_REFERENCE_BEGIN
//             <div className="header">
// MIGRATION_REFERENCE_END
