// this is not a *markdown plugin*
// but a plugin used by our markdown-react system

import "@webscopeio/react-textarea-autocomplete/style.css";
import * as abcjs from 'abcjs';
import 'abcjs/abcjs-audio.css';
import React from "react";


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

//---------------------------------------------------------------------------------------
export const ABCReactPlugin = (node: Element, componentName: string, propsString: string) => {
    if (node.getAttribute("data-inline")) {
        return <ABCInlineComponent abcCode={propsString} />;
    }
    return <ABCBlockComponent abcCode={propsString} />;
};

