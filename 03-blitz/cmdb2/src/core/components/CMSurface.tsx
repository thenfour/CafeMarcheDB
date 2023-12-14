// client-side surface API.

// import { assert } from 'blitz';
// import React from 'react';
// import { CMSurfaceContextType } from 'shared/CMSurface';
// import { CoalesceBool } from 'shared/utils';

// interface CMSurfaceRootContextType {
//     refCount: number;
// };
// const CMSurfaceRootContext = React.createContext<CMSurfaceRootContextType>({
//     refCount: 0,
// });

// // there should only be 1 of these, to emit root-level CSS to be used by surface API.
// export const CMSurfaceRoot = () => {
//     const rootCtx = React.useContext(CMSurfaceRootContext);
//     assert(rootCtx.refCount === 0, "only use one CMSurfaceRoot. using multiple would emit dupe CSS.");

//     return <CMSurfaceRootContext.Provider value={{
//         refCount: rootCtx.refCount + 1,
//     }}>
//         <style>
//             --palette-entry-0000: #eeeeee;
//             --palette-entry-0001: #ffffff;
//         </style>
//     </CMSurfaceRootContext.Provider>;
// };

// export const CMSurfaceContext = React.createContext<CMSurfaceContextType>({
//     elevation: -1,
//     selected: false,
//     enabled: false,
//     interactable: false,
//     faded: false,
//     //hovered: false,
// });

// export interface CMSurfaceProps {
//     selected?: boolean,
//     enabled?: boolean,
//     interactable?: boolean,
//     hovered?: boolean,
//     className?: string;
// };

// // assumes that
// export const GetStyleForSurface = (color: ColorPaletteEntry | null | string | undefined) => {
//     if (typeof color === 'string') {
//         color = gGeneralPaletteList.findEntry(color);
//     }
//     const entry = !!color ? color : CreateNullPaletteEntry();

//     return {
//         "--strong-color": entry.strongValue,
//         "--strong-contrast-color": entry.strongContrastColor,
//         "--strong-border-color": entry.strongOutline ? entry.strongContrastColor : "#d8d8d8",
//         "--strong-border-style": (color == null) ? "dotted" : (color.strongOutline ? "solid" : "hidden"),

//         "--weak-color": entry.weakValue,
//         "--weak-contrast-color": entry.weakContrastColor,
//         "--weak-border-color": entry.weakOutline ? entry.weakContrastColor : "#d8d8d8",
//         "--weak-border-style": (color == null) ? "dotted" : (color.weakOutline ? "solid" : "hidden"),

//         "--disabled-color": "#eee",
//         "--disabled-contrast-color": "#999",
//         "--disabled-border-color": "#999",
//         "--disabled-border-style": "solid",
//     } as React.CSSProperties;
// }


// export const CMSurface = (props: React.PropsWithChildren<CMSurfaceProps>) => {
//     const surfaceCtx = React.useContext(CMSurfaceContext);

//     // increase elevation & reset flags
//     const thisSurface: CMSurfaceContextType = {
//         elevation: surfaceCtx.elevation + 1,
//         selected: CoalesceBool(props.selected, false),
//         enabled: CoalesceBool(props.enabled, false),
//         interactable: CoalesceBool(props.interactable, false),
//         //hovered: CoalesceBool(props.hovered, false),
//     };

//     // set styling variables for this.

//     return <CMSurfaceContext.Provider value={thisSurface}>
//         <div className={props.className} style={style}>
//             {props.children}
//         </div>
//     </CMSurfaceContext.Provider>;
// };

