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

import "@webscopeio/react-textarea-autocomplete/style.css";
import MarkdownIt from 'markdown-it';
import React from "react";
import { createRoot } from 'react-dom/client';

import { IsNullOrWhitespace } from "shared/utils";

import { NoSsr } from '@mui/material';
import { getURLClass } from "../../db3/clientAPILL";
import { CMDBLinkMarkdownPlugin } from './CMDBLinkMarkdownPlugin';
import { ImageDimensionsMarkdownPlugin } from './ImageDimensionsMarkdownPlugin';
import { markdownReactPlugins } from './MarkdownReactPlugins';
import { ReactBlockMarkdownPlugin } from './ReactBlockMarkdownPlugin';
import { ReactInlineMarkdownPlugin } from './ReactInlineMarkdownPlugin';


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
        const md = new MarkdownIt({
            linkify: true,
        });

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

        const onComponentAdd = () => {
            expectedComponentCount.current++;
        }

        md.use(md => ReactInlineMarkdownPlugin(md, onComponentAdd));
        md.use(md => ReactBlockMarkdownPlugin(md, onComponentAdd));
        md.use(ImageDimensionsMarkdownPlugin);
        md.use(CMDBLinkMarkdownPlugin);

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
            //console.log(`unprocessed children: ${expectedComponentCount.current}`);
        };

        componentMountTimer.current = setInterval(TimerProc, 33);

    }, [props.markdown]);

    return <NoSsr>
        {IsNullOrWhitespace(props.markdown) ? null :
            <div className={`markdown renderedContent ${props.compact && "compact"} ${props.className || ""}`} onClick={props.onClick}>
                <div className='extraContainerDiv' ref={containerRef} id={props.id} dangerouslySetInnerHTML={{ __html: html }}></div>
            </div>
        }
    </NoSsr>;
};
