// <Markdown> = rendered markdown text (simple read only html)
// <MarkdownEditor> = just the text editor which outputs markdown
// <MarkdownControl> = full editor with debounced commitment (caller actually commits), displays saving indicator, switch between edit/view

// syntax updates:
// ```abc
// ```

// inline ABC:
// {{abc:...}}

// rehearsal mark:
// {{enclosed:...}}

// references?
// wiki, song, event, ...?

// image dimensions

import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import PersonIcon from '@mui/icons-material/Person';
import ReactTextareaAutocomplete from "@webscopeio/react-textarea-autocomplete";
import "@webscopeio/react-textarea-autocomplete/style.css";
import * as abcjs from 'abcjs';
import 'abcjs/abcjs-audio.css';
import MarkdownIt from 'markdown-it';
import React from "react";
import { createRoot } from 'react-dom/client';

import { Permission } from "shared/permissions";
import { slugify } from "shared/rootroot";
import { IsNullOrWhitespace, isValidURL, parseMimeType } from "shared/utils";
import { SnackbarContext } from "src/core/components/SnackbarContext"; // 0 internal refs
import { MatchingSlugItem } from "../../db3/shared/apiTypes"; // 0 internal refs

import { NoSsr } from '@mui/material';
import { getURLClass } from "../../db3/clientAPILL";
import { CMDBUploadFile } from "../CMDBUploadFile";
import { CollapsableUploadFileComponent, FileDropWrapper } from "../FileDrop";
import { fetchObjectQuery } from '../setlistPlan/ItemAssociation';

const INDENT_SIZE = 4;  // Number of spaces for one indent level
const SPACES = ' '.repeat(INDENT_SIZE);

interface MarkdownReactPlugin {
    componentName: string;
    render: (node: Element, componentName: string, propsString: string) => React.ReactNode;
};

const RenderMarkdownSpanWithClass = (node: Element, componentName: string, propsString: string) => {
    return <span className={`markdown-class-${componentName}`}>{propsString}</span>
};

const spanClasses = [
    "big",
    "bigger",
    "highlight",
    "highlightred",
    "highlightblue",
    "highlightgreen",
    "enclosed",
] as const;

interface ABCProps {
    abcCode: string;
};

const ABCInlineComponent = (props: ABCProps) => {
    const ref = React.useRef<HTMLSpanElement | null>(null);
    React.useEffect(() => {
        const result = abcjs.renderAbc(ref.current!, props.abcCode, {
            staffwidth: 60, // this is a minimum width i guess? hard to understand what's going on here but it works
            paddingbottom: 0,
            paddingleft: 0,
            paddingright: 0,
            paddingtop: 0,
        });
    });
    return <span ref={ref}></span>;
};

const ABCBlockComponent = (props: ABCProps) => {
    const ref = React.useRef<HTMLDivElement | null>(null);
    React.useEffect(() => {
        const result = abcjs.renderAbc(ref.current!, props.abcCode, {
            staffwidth: 690, // eh.
        });
    });
    return <div ref={ref}></div>;
};

const ABCReactPlugin = (node: Element, componentName: string, propsString: string) => {
    if (node.getAttribute("data-inline")) {
        return <ABCInlineComponent abcCode={propsString} />;
    }
    return <ABCBlockComponent abcCode={propsString} />;
};

const markdownReactPlugins: MarkdownReactPlugin[] = [
    ...spanClasses.map(className => ({
        componentName: className,
        render: RenderMarkdownSpanWithClass,
    })),
    {
        componentName: "abc",
        render: ABCReactPlugin
    }
];


function markdownItReactInline(md: MarkdownIt, onComponentAdd: () => void) {
    const defaultRender = md.renderer.rules.text || ((tokens, idx, options, env, self) => {
        return self.renderToken(tokens, idx, options);
    });

    md.renderer.rules.text = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        const text = token.content as string;
        // {{word:props}} or {{word}}
        let newText = text.replace(/\{\{(\w+)(:.*?)?\}\}/g, (match, componentName, propsString = '') => {
            if (propsString && propsString.length > 1) {
                propsString = propsString.slice(1).replaceAll("\\}", "}"); // chop off the colon and allow escaping } with \}
            }

            const span = document.createElement('span');
            span.setAttribute("data-component", componentName);
            span.setAttribute("data-props", propsString);
            span.setAttribute("data-inline", "true");
            onComponentAdd();
            return span.outerHTML;
        });

        // Call default renderer for any remaining text
        return newText === text ? defaultRender(tokens, idx, options, env, self) : newText;
    };
}


function markdownItReactBlock(md: MarkdownIt, onComponentAdd: () => void) {
    function render(tag: string, content: string) {
        const div = document.createElement("div");
        div.setAttribute("data-component", tag);
        div.setAttribute("data-props", content.trim());
        onComponentAdd();
        return div.outerHTML;
    }

    // Block ABCjs rule
    md.core.ruler.after('block', 'abc', function (state) {
        state.tokens.forEach(token => {
            if (token.type !== 'fence') return;
            // token.info is the little tag. like ```tag
            if (!markdownReactPlugins.some(p => p.componentName === token.info)) return;
            //if (token.info !== 'abc') return; 

            token.type = 'html_block';
            token.content = render(token.info, token.content);
            token.tag = '';
            token.nesting = 0;
            token.attrs = null;
            token.map = null;
            token.children = null;
        });
    });
}

function markdownItImageDimensions(md) {
    const defaultRender = md.renderer.rules.image || function (tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
    };

    md.renderer.rules.image = function (tokens, idx, options, env, self) {
        const token = tokens[idx];
        const srcIndex = token.attrIndex('src');

        if (srcIndex >= 0) {
            const srcAttr = token.attrs[srcIndex][1];
            const dimensionMatch = srcAttr.match(/^(.*?)(\?\d+)$/);

            if (dimensionMatch && dimensionMatch.length > 2) {
                const url = dimensionMatch[1]; // The actual URL without the dimension part
                const dimension = dimensionMatch[2].substring(1); // Remove the '?' to get the dimension

                // Update the src attribute to the clean URL without the dimension query
                token.attrs[srcIndex][1] = url;

                // Apply the dimension as a style for both max-width and max-height
                token.attrPush(['style', `max-width: ${dimension}px; max-height: ${dimension}px;`]);
            }
        }

        return defaultRender(tokens, idx, options, env, self);
    };
};


function cmLinkPlugin(md) {
    const defaultRender = md.renderer.rules.html_inline || function (tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
    };

    md.renderer.rules.text = function (tokens, idx, options, env, self) {
        const token = tokens[idx];
        // Updated regex to capture both old and new link types
        const linkRegex = /\[\[(event|song):(\d+)\|?(.*?)\]\]/g;

        if (token.content.match(linkRegex)) {
            token.content = token.content.replace(linkRegex, (match, type, id, caption) => {
                if (id && type === 'event') {
                    caption = caption || `Event ${id}`; // Default caption if none provided
                    return `<a href="/backstage/event/${id}" class="wikiCMLink wikiEventLink">📅 ${caption}</a>`;
                }
                if (id && type === 'song') {
                    caption = caption || `Song ${id}`; // Default caption if none provided
                    return `<a href="/backstage/song/${id}" class="wikiCMLink wikiSongLink">🎵 ${caption}</a>`;
                }
            });
        }

        const wikiRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

        if (token.content.match(wikiRegex)) {
            token.content = token.content.replace(wikiRegex, (match, slug, caption) => {
                if (slug) {
                    caption = caption || slug;
                    return `<a href="/backstage/wiki/${slugify(slug)}" class="wikiCMLink wikiWikiLink">${caption}</a>`;
                }
            });
        }

        return defaultRender(tokens, idx, options, env, self);
    };
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface MarkdownProps {
    markdown: string | null,
    id?: string,
    className?: string,
    compact?: boolean,
    onClick?: () => void,
}
export const Markdown = (props: MarkdownProps) => {
    const [html, setHtml] = React.useState('');
    const expectedComponentCount = React.useRef<number>(0);
    const componentMountTimer = React.useRef<NodeJS.Timer | null>(null);

    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        //if (!containerRef.current) return;
        if (componentMountTimer.current) {
            clearInterval(componentMountTimer.current);
            componentMountTimer.current = null;
        }
        expectedComponentCount.current = 0; // make sure we're counting from 0

        if (IsNullOrWhitespace(props.markdown)) {
            setHtml("");
            return;
        }
        const md = new MarkdownIt();

        // https://github.com/markdown-it/markdown-it/blob/master/docs/architecture.md#renderer
        // this adds attribute target=_blank so links open in new tab.
        // Remember old renderer, if overridden, or proxy to default renderer
        var defaultRender = md.renderer.rules.link_open || function (tokens, idx, options, env, self) {
            return self.renderToken(tokens, idx, options);
        };

        md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
            // If you are sure other plugins can't add `target` - drop check below
            var ihref = tokens[idx].attrIndex('href');
            let className = " externalLink";
            let addTargetBlank = true;

            if (ihref >= 0) {
                // distinguish internal vs. external.
                const href = tokens[idx].attrs[ihref][1];
                if (href) {
                    const hrefClass = getURLClass(href);
                    switch (hrefClass) {
                        case "external":
                            className = " externalLink opensInNewTab";
                            addTargetBlank = true;
                            break;
                        case "internalAPI":
                            className = " internalAPILink opensInNewTab";
                            addTargetBlank = true;
                            break;
                        case "internalPage":
                            className = " internalPageLink";
                            addTargetBlank = false;
                            break;
                    }
                }
            }

            var itarget = tokens[idx].attrIndex('target');
            if (addTargetBlank) {
                if (itarget < 0) {
                    tokens[idx].attrPush(['target', '_blank']); // add new attribute
                } else {
                    tokens[idx].attrs[itarget][1] = '_blank';    // replace value of existing attr
                }
            }

            // add class
            var iclass = tokens[idx].attrIndex('class');
            if (iclass < 0) {
                tokens[idx].attrPush(['class', className]);
            } else {
                tokens[idx].attrs[iclass][1] += className;
            }

            // pass token to default renderer.
            return defaultRender(tokens, idx, options, env, self);
        };

        md.use(cmLinkPlugin);
        md.use(markdownItImageDimensions);

        const onComponentAdd = () => {
            expectedComponentCount.current++;
            //console.log(`oncomponent add; ${expectedComponentCount.current}`);
        }
        md.use(md => markdownItReactInline(md, onComponentAdd));
        md.use(md => markdownItReactBlock(md, onComponentAdd));

        setHtml(md.render(props.markdown));

        // mount embedded react components. we have to wait for the browser to get this mounted and it's not possible to know when it will be.
        // careful also to consider multiple markdown components on the page at the same time so global flags will break.
        // how to accomplish this? we want to choose an interval carefully, polling for readiness. maybe set an expected component value somehow?
        const TimerProc = () => {
            if (!containerRef.current) {
                return; // i guess wait longer? honestly i don't expect this to happen.
            }
            if (expectedComponentCount.current < 1) {
                if (componentMountTimer.current) clearInterval(componentMountTimer.current);
                return;
            }
            const allNodes = containerRef.current.querySelectorAll('[data-component]');
            const nodes = Array.from(allNodes).filter(el => !el.getAttribute('data-rendered'));

            // count all nodes in case of weird reloads; expected component count bases itself on the TOTAL

            nodes.forEach(node => {
                const componentName = node.getAttribute('data-component');
                if (!componentName) return;
                node.setAttribute("data-rendered", "true");

                const lowercaseComponentName = componentName.toLowerCase();
                for (let i = 0; i < markdownReactPlugins.length; ++i) {
                    const plugin = markdownReactPlugins[i]!;
                    if (plugin.componentName === lowercaseComponentName) {
                        const root = createRoot(node);
                        const renderedComponent = plugin.render(node, lowercaseComponentName, node.getAttribute('data-props') || "");
                        root.render(renderedComponent);
                        node.setAttribute("data-rendered-with-plugin", plugin.componentName);
                        break;
                    }
                }
            });

            expectedComponentCount.current -= allNodes.length;
            console.log(`unprocessed children: ${expectedComponentCount.current}`);
        };

        componentMountTimer.current = setInterval(TimerProc, 33);

    }, [props.markdown]);

    return <NoSsr>
        <div className={`markdown renderedContent ${props.compact && "compact"} ${props.className || ""}`} onClick={props.onClick}>
            <div className='extraContainerDiv' ref={containerRef} id={props.id} dangerouslySetInnerHTML={{ __html: html }}></div>
        </div >
    </NoSsr>;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function fetchWikiSlugs(keyword: string): Promise<string[]> {
    if (keyword.includes("]]")) return []; // make sure we don't autocomplete outside of the link syntax
    if (!keyword.startsWith("[")) {
        return []; // ensure this is a wiki link. you typed "[" to trigger the autocomplete. this is the 2nd '['
    }
    if (keyword.startsWith("[@")) { // don't handle this.
        return [];
    }

    const slugified = slugify(keyword);
    const response = await fetch(`/api/wiki/searchWikiSlugs?keyword=${slugified}`);

    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    return response.json();
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function fetchInlineClasses(keyword: string): Promise<string[]> {
    if (keyword.includes("}}")) return []; // make sure we don't autocomplete outside of the link syntax
    if (!keyword.startsWith("{")) {
        return []; // ensure this is a wiki link. you typed "[" to trigger the autocomplete. this is the 2nd '['
    }
    const ret = [
        ...spanClasses,
        "abc",
    ].filter(x => x.toLowerCase().includes(keyword.slice(1).toLowerCase()));
    return ret;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
async function fetchEventOrSongTagsAt(keyword: string): Promise<MatchingSlugItem[]> {
    // no prefix here.
    if (keyword.includes("]]")) return []; // make sure we don't autocomplete outside of the link syntax
    return await fetchObjectQuery(keyword);
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface MarkdownEditorProps {
    value: string | null, // value which may be coming from the database.
    onValueChanged: (val: string) => void, // caller can save the changed value to a db here.
    onSave?: () => void,
    nominalHeight: number,
    autoFocus?: boolean;
    displayUploadFileComponent?: boolean;

    headingTrig?: undefined | number; // set this to a new instance to trigger heading toolbar item. when 0, does not trigger (to avoid triggering on 1st mount)
    boldTrig?: undefined | number;
    italicTrig?: undefined | number;
    quoteTrig?: undefined | number;
    codeTrig?: undefined | number;
    linkTrig?: undefined | number;
    orderedListTrig?: undefined | number;
    unorderedListTrig?: undefined | number;
    attachFilesTrig?: undefined | number;
    mentionTrig?: undefined | number;
    referenceTrig?: undefined | number;
    indentTrig?: undefined | number;
    outdentTrig?: undefined | number;
    underlineTrig?: undefined | number;
    strikethroughTrig?: undefined | number;
    refocusTrig?: undefined | number;
    abcjsTrig?: undefined | number;
    specialCharacterTrig?: undefined | number;
    specialCharacter?: string;
}

export function MarkdownEditor(props: MarkdownEditorProps) {
    const [progress, setProgress] = React.useState<number | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const ta = React.useRef<any>({});

    const maxImageDimension = 800;

    const setTa = (v) => {
        ta.current = v;
    };

    const style: React.CSSProperties = {
        //minHeight: props.height,
        height: props.nominalHeight
    };

    const insertTextAtCursor = (textToInsert) => {
        const textarea = ta.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const textBefore = textarea.value.substring(0, start);
        const textAfter = textarea.value.substring(end, textarea.value.length);

        const newText = textBefore + textToInsert + textAfter;
        props.onValueChanged(newText);

        //setTimeout(() => textarea.selectionStart = textarea.selectionEnd = start + textToInsert.length + 1, 0);
    };

    const formatText = (startMarker, endMarker = startMarker) => {
        const textarea = ta.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const textBefore = textarea.value.substring(0, start);
        const textAfter = textarea.value.substring(end);
        const selectedText = textarea.value.substring(start, end);

        let newText;
        if (selectedText.length > 0) {
            newText = `${textBefore}${startMarker}${selectedText}${endMarker}${textAfter}`;
            setTimeout(() => {
                textarea.selectionStart = start;
                textarea.selectionEnd = end + startMarker.length + endMarker.length;
                //console.log(`focusing text 503`);
                textarea.focus();
            }, 0);
        } else {
            newText = `${textBefore}${startMarker}${endMarker}${textAfter}`;
            setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = start + startMarker.length;
                //console.log(`focusing text 510`);
                textarea.focus();
            }, 0);
        }

        //textarea.value = newText;
        props.onValueChanged(newText);
    };

    const insertBlockquote = () => {
        const textarea = ta.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const textBefore = textarea.value.substring(0, start);
        const textAfter = textarea.value.substring(end);
        const selectedText = textarea.value.substring(start, end);

        // Check if the selection is on a new line or not
        const prefix = textBefore.endsWith('\n') || start === 0 ? '' : '\n';
        let newText;

        if (selectedText.length > 0) {
            // Apply blockquote to each line in the selection
            const quotedText = selectedText.split('\n').map(line => `> ${line}`).join('\n');
            newText = `${textBefore}${prefix}${quotedText}${textAfter}`;
            setTimeout(() => {
                textarea.selectionStart = start + prefix.length;
                textarea.selectionEnd = start + prefix.length + quotedText.length;
                //console.log(`focusing text 54`);
                textarea.focus();
            }, 0);
        } else {
            // Insert an empty blockquote template
            newText = `${textBefore}${prefix}> ${textAfter}`;
            setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = start + prefix.length + 2; // Position cursor right after "> "
                //console.log(`focusing text htn`);
                textarea.focus();
            }, 0);
        }

        //textarea.value = newText;
        //if (typeof props.onValueChanged === 'function') {
        props.onValueChanged(newText);
        //}
    };

    const insertList = (type) => {
        const textarea = ta.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const textBefore = textarea.value.substring(0, start);
        const textAfter = textarea.value.substring(end);
        const selectedText = textarea.value.substring(start, end);

        // Prepare the list prefix based on the type
        const listMarker = type === 'unordered' ? '- ' : '1. ';
        const prefix = textBefore.endsWith('\n') || start === 0 ? '' : '\n';

        let newText;
        if (selectedText.length > 0) {
            // Convert each selected line into a list item
            let lineNum = 1;
            const modifiedText = selectedText.split('\n').map(line => {
                const marker = type === 'unordered' ? listMarker : `${lineNum++}. `;
                return `${marker}${line}`;
            }).join('\n');
            newText = `${textBefore}${prefix}${modifiedText}${textAfter}`;
            setTimeout(() => {
                textarea.selectionStart = start + prefix.length;
                textarea.selectionEnd = start + prefix.length + modifiedText.length;
                //console.log(`focusing text chhtn`);
                textarea.focus();
            }, 0);
        } else {
            // Insert an empty list item template
            newText = `${textBefore}${prefix}${listMarker}${textAfter}`;
            setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = start + prefix.length + listMarker.length;
                //console.log(`focusing text 99htn`);
                textarea.focus();
            }, 0);
        }

        // textarea.value = newText;
        // if (typeof props.onValueChanged === 'function') {
        props.onValueChanged(newText);
        // }
    };

    const insertLink = () => {
        const textarea = ta.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const textBefore = textarea.value.substring(0, start);
        const textAfter = textarea.value.substring(end);
        const selectedText = textarea.value.substring(start, end);

        let newText;

        if (isValidURL(selectedText)) {
            // Selected text is a URL, use it as the URL and place the cursor in the text field
            const placeholderText = "link_caption";
            newText = `${textBefore}[${placeholderText}](${selectedText})${textAfter}`;
            // Set cursor to inside the square brackets to let user type the link text
            setTimeout(() => {
                textarea.selectionStart = start + 1; // After '['
                textarea.selectionEnd = start + placeholderText.length + 1; // Before ']'
                //console.log(`focusing text h987tn`);
                textarea.focus();
            }, 0);
        } else {
            // Selected text is not a URL, use it as the link text
            const placeholderText = "url_here";
            newText = `${textBefore}[${selectedText}](${placeholderText})${textAfter}`;
            // Set cursor between parentheses to let user type the URL
            const insertPosition = start + selectedText.length + 3; // +3 to account for "[]("
            setTimeout(() => {
                textarea.selectionStart = insertPosition; // After '('
                textarea.selectionEnd = insertPosition + placeholderText.length; // Before ')'
                //console.log(`focusing text htn6666`);
                textarea.focus();
            }, 0);
        }

        //textarea.value = newText;
        //textarea.focus(); // Ensure the textarea is focused after updating
        //if (typeof props.onValueChanged === 'function') {
        props.onValueChanged(newText);
        //}
    };

    const increaseIndent = () => {
        const textarea = ta.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const textBefore = textarea.value.substring(0, start);
        const textAfter = textarea.value.substring(end);
        const selectedText = textarea.value.substring(start, end);

        let newText;
        if (selectedText.length > 0) {
            // Indent each line in the selection
            const indentedText = selectedText.split('\n').map(line => SPACES + line).join('\n');
            newText = textBefore + indentedText + textAfter;
            setTimeout(() => {
                textarea.selectionStart = start;
                textarea.selectionEnd = start + indentedText.length;
                //console.log(`focusing te7f7dxt htn`);
                textarea.focus();
            }, 0);
        } else {
            // Indent the current line
            const lineStart = textBefore.lastIndexOf('\n') + 1;
            newText = textarea.value.substring(0, lineStart) + SPACES + textarea.value.substring(lineStart);
            setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = start + INDENT_SIZE;
                //console.log(`focusithdg text htn`);
                textarea.focus();
            }, 0);
        }

        //textarea.value = newText;
        //if (typeof props.onValueChanged === 'function') {
        props.onValueChanged(newText);
        //}
    };

    const decreaseIndent = () => {
        const textarea = ta.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const textBefore = textarea.value.substring(0, start);
        const textAfter = textarea.value.substring(end);
        const selectedText = textarea.value.substring(start, end);

        let newText;
        if (selectedText.length > 0) {
            // Outdent each line in the selection
            const outdentedText = selectedText.split('\n').map(line => line.startsWith(SPACES) ? line.substring(INDENT_SIZE) : line).join('\n');
            newText = textBefore + outdentedText + textAfter;
            setTimeout(() => {
                textarea.selectionStart = start;
                textarea.selectionEnd = start + outdentedText.length;
                //console.log(`focust htn`);
                textarea.focus();
            }, 0);
        } else {
            // Outdent the current line
            const lineStart = textBefore.lastIndexOf('\n') + 1;
            const currentLine = textarea.value.substring(lineStart);
            if (currentLine.startsWith(SPACES)) {
                newText = textarea.value.substring(0, lineStart) + currentLine.substring(INDENT_SIZE);
                setTimeout(() => {
                    textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, start - INDENT_SIZE);
                    //console.log(`focusingrrhtn`);
                    textarea.focus();
                }, 0);
            } else {
                newText = textarea.value;  // No indent to remove
                setTimeout(() => {
                    textarea.selectionStart = textarea.selectionEnd = start;
                    //console.log(`focusirrrrrhtn`);
                    textarea.focus();
                }, 0);
            }
        }

        //textarea.value = newText;
        //if (typeof props.onValueChanged === 'function') {
        props.onValueChanged(newText);
        //}
    };

    // ok when you upload, the gallery item component is created.
    const handleFileSelect = (files: FileList) => {
        if (files.length > 0) {
            setProgress(0);
            CMDBUploadFile({
                fields: {
                    visiblePermission: Permission.visibility_public,
                },
                files,
                onProgress: (prog01, uploaded, total) => {
                    setProgress(prog01);
                },
                maxImageDimension,
            }).then((resp) => {
                setProgress(null);

                const toInsert = resp.files.map(f => {
                    const url = `/api/files/download/${f.storedLeafName}`; // relative url is fine.
                    const mimeInfo = parseMimeType(f.mimeType);
                    const isImage = mimeInfo?.type === 'image';
                    if (isImage) {
                        return `![${f.fileLeafName}](${url})`;
                    }
                    return `[${f.fileLeafName}](${url})`;
                }).join(" ");

                insertTextAtCursor(toInsert);

                if (!resp.isSuccess) {
                    throw new Error(`Server returned unsuccessful result while uploading files`);
                }
                showSnackbar({ severity: "success", children: `Uploaded file(s)` });
            }).catch((e: string) => {
                console.log(e);
                showSnackbar({ severity: "error", children: `error uploading file(s) : ${e}` });
            });
        }
    };

    const handlePaste = (e) => {
        if ((e.clipboardData?.files?.length || 0) > 0) {
            handleFileSelect(e.clipboardData!.files);
            e.preventDefault();
        }
    };

    const ToolbarActions = {
        heading: () => { insertTextAtCursor(`\n### `); ta.current.focus(); },
        bold: () => formatText('**'),
        italic: () => formatText('*'),
        underline: () => formatText('<u>', "</u>"),
        strikethrough: () => formatText("~~"),
        code: () => formatText('`'),
        quote: () => insertBlockquote(),
        orderedList: () => insertList('ordered'),
        unorderedList: () => insertList('unordered'),
        link: () => insertLink(),
        mention: () => { insertTextAtCursor("@"); ta.current.focus(); },
        reference: () => { insertTextAtCursor("[["); ta.current.focus(); },
        indent: () => increaseIndent(),
        outdent: () => decreaseIndent(),
        attachFiles: () => {
            if (fileInputRef.current) {
                fileInputRef.current.click();
            }
        },
        //abcjs: () => insertABCjsBlock(),
        abcjs: () => formatText("\n```abc\n", "\n```\n"),
    };

    React.useEffect(() => {
        if ((props.headingTrig || 0) > 0) {
            ToolbarActions.heading();
        }
    }, [props.headingTrig]);

    React.useEffect(() => {
        if ((props.boldTrig || 0) > 0) {
            ToolbarActions.bold();
        }
    }, [props.boldTrig]);

    React.useEffect(() => {
        if ((props.italicTrig || 0) > 0) {
            ToolbarActions.italic();
        }
    }, [props.italicTrig]);


    // Add an effect for the new trigger, similar to others
    React.useEffect(() => {
        if ((props.abcjsTrig || 0) > 0) {
            ToolbarActions.abcjs();
        }
    }, [props.abcjsTrig]);

    React.useEffect(() => {
        if ((props.underlineTrig || 0) > 0) {
            ToolbarActions.underline();
        }
    }, [props.underlineTrig]);


    React.useEffect(() => {
        if ((props.strikethroughTrig || 0) > 0) {
            ToolbarActions.strikethrough();
        }
    }, [props.strikethroughTrig]);

    React.useEffect(() => {
        if ((props.codeTrig || 0) > 0) {
            ToolbarActions.code();
        }
    }, [props.codeTrig]);

    React.useEffect(() => {
        if ((props.quoteTrig || 0) > 0) {
            ToolbarActions.quote();
        }
    }, [props.quoteTrig]);

    React.useEffect(() => {
        if ((props.unorderedListTrig || 0) > 0) {
            ToolbarActions.unorderedList();
        }
    }, [props.unorderedListTrig]);

    React.useEffect(() => {
        if ((props.orderedListTrig || 0) > 0) {
            ToolbarActions.orderedList();
        }
    }, [props.orderedListTrig]);

    React.useEffect(() => {
        if ((props.linkTrig || 0) > 0) {
            ToolbarActions.link();
        }
    }, [props.linkTrig]);

    React.useEffect(() => {
        if ((props.mentionTrig || 0) > 0) {
            ToolbarActions.mention();
        }
    }, [props.mentionTrig]);

    React.useEffect(() => {
        if ((props.referenceTrig || 0) > 0) {
            ToolbarActions.reference();
        }
    }, [props.referenceTrig]);

    React.useEffect(() => {
        if ((props.indentTrig || 0) > 0) {
            ToolbarActions.indent();
        }
    }, [props.indentTrig]);

    React.useEffect(() => {
        if ((props.outdentTrig || 0) > 0) {
            ToolbarActions.outdent();
        }
    }, [props.outdentTrig]);

    React.useEffect(() => {
        if ((props.attachFilesTrig || 0) > 0) {
            ToolbarActions.attachFiles();
        }
    }, [props.attachFilesTrig]);

    React.useEffect(() => {
        if ((props.refocusTrig || 0) > 1) { // this always gets incremented once because of internal state changing. wait until 2 before actually focusing.
            //console.log(`focusin9999 htn refocusTrig = ${props.refocusTrig || 0}`);
            ta.current.focus();
        }
    }, [props.refocusTrig]);

    React.useEffect(() => {
        if ((props.specialCharacterTrig || 0) > 0) {
            insertTextAtCursor(props.specialCharacter);
            //console.log(`focusxgxgxgxgxgxgxext htn`);
            ta.current.focus();
        }
    }, [props.specialCharacterTrig]);

    const handleNativeFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            handleFileSelect(e.target.files);
            e.target.files = null; // clear
            e.target.value = ""; // clear
        }
    };

    React.useEffect(() => {
        const handleKeyDown = (event) => {
            if (!event.ctrlKey && !event.metaKey) return;
            switch (event.key.toUpperCase()) {
                case 'B':
                    event.preventDefault();
                    ToolbarActions.bold();
                    break;
                case 'I':
                    event.preventDefault();
                    ToolbarActions.italic();
                    break;
                case 'U':
                    event.preventDefault();
                    ToolbarActions.underline();
                    break;
                case 'H':
                    event.preventDefault();
                    ToolbarActions.heading();
                    break;
                case 'S':
                    if (event.shiftKey) {
                        event.preventDefault();
                        ToolbarActions.strikethrough();
                    } else {
                        if (props.onSave) {
                            event.preventDefault();
                            props.onSave();
                        }
                    }
                    break;
                case 'K':
                    event.preventDefault();
                    ToolbarActions.link();
                    break;
                case 'Q':
                    if (event.shiftKey) {
                        event.preventDefault();
                        ToolbarActions.quote();
                    }
                    break;
                case 'O':
                    if (event.shiftKey) {
                        event.preventDefault();
                        ToolbarActions.orderedList();
                    }
                    break;
                case 'M':
                    event.preventDefault();
                    ToolbarActions.mention();
                    break;
                case ']':
                    event.preventDefault();
                    ToolbarActions.indent();
                    break;
                case '[':
                    event.preventDefault();
                    ToolbarActions.outdent();
                    break;
            }
        };

        const textarea = ta.current;
        textarea.addEventListener('keydown', handleKeyDown);

        return () => {
            textarea.removeEventListener('keydown', handleKeyDown);
        };
    }, []);


    return (<div className="FileUploadWrapperContainer">
        <FileDropWrapper
            className="frontpageGalleryFileUploadWrapper"
            onFileSelect={handleFileSelect}
            onURLUpload={() => { }}
            progress={progress}
        >
            <input
                type="file"
                multiple
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleNativeFileSelect}
            />
            <ReactTextareaAutocomplete
                containerClassName="editorContainer"
                loadingComponent={() => <div>Loading...</div>}
                autoFocus={false}
                innerRef={textarea => setTa(textarea)}
                value={props.value || ""}
                height={props.nominalHeight || 400}
                style={style}
                onChange={(e) => {
                    props.onValueChanged(e.target.value);
                }}
                onPaste={handlePaste}
                minChar={1} // how many chars AFTER the trigger char you need to type before the popup arrives

                trigger={{
                    "[[": { // it's hard to understand how these triggers work; are these chars or strings??
                        dataProvider: token => fetchWikiSlugs(token),
                        // renders the item in the suggestion list.
                        component: ({ entity, selected }: { entity: string, selected: boolean }) => <div className={`autoCompleteCMLinkItem wiki ${selected ? "selected" : "notSelected"}`}>{entity}</div>,
                        output: (item: string) => `[[${item}]]`
                    },
                    "{{": { // it's hard to understand how these triggers work; are these chars or strings??
                        dataProvider: token => fetchInlineClasses(token),
                        component: ({ entity, selected }: { entity: string, selected: boolean }) => <div className={`autoCompleteCMLinkItem inlineclass ${selected ? "selected" : "notSelected"}`}>{entity}</div>,
                        output: (item: string) => `{{${item}:}}`
                    },
                    "@": {
                        dataProvider: token => fetchEventOrSongTagsAt(token),
                        component: ({ entity, selected }: { entity: MatchingSlugItem, selected: boolean }) => <div className={`autoCompleteCMLinkItem ${entity.itemType} ${selected ? "selected" : "notSelected"}`}>
                            {entity.itemType === "event" && <CalendarMonthIcon />}
                            {entity.itemType === "song" && <MusicNoteIcon />}
                            {entity.itemType === "user" && <PersonIcon />}
                            {entity.itemType === "instrument" && <MusicNoteIcon />}
                            {entity.name}
                        </div>,
                        output: (item: MatchingSlugItem) => `[[${item.itemType}:${item.id}|${item.name}]]`
                    },
                }}
            />
            {(props.displayUploadFileComponent) && <CollapsableUploadFileComponent
                onFileSelect={handleFileSelect}
                enablePaste={false} // because paste is handled inline in the textarea.
                progress={progress}
            />}
        </FileDropWrapper>
    </div>
    );
}

