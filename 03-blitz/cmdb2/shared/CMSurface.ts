// um i like the concept of this, but it's too much investment for now.
// the basic idea is to have at the base, a fixed palette (list of colors)
// then on the other end of things, GUI has surfaces which have things like elevation, selectable, disabled, hover, faded, primary color, etc.
// and in between are mechanics which map palette entries to surface features based on those parameters.

// the idea sounds cool, and probably worth doing someday but will take tweaking and thought that i don't have time for.

// shared (server-accessible) API for cm surfaces


/*

:root {
    --palette-entry-0000: #eeeeee;
    --palette-entry-0001: #ffffff;

    // no surface
}

.surface { // surface 1
    --surface-feature-border: var(--palette-entry-0000);
    --surface-feature-background: var(--palette-entry-0001);
}

.surface .surface { // surface level 2
    --surface-feature-border: var(--palette-entry-0000);
    --surface-feature-background: var(--palette-entry-0000);
}

*/

// interface PaletteEntry {
//     index: number;
//     color: string;
//     name: string; // necessary? for mapping palette-to-palette it feels like we could befenit from symbolic color names.
// };

// let gPaletteIndex: number = 0;

// function palN(color: string, name?: string): PaletteEntry {
//     return {
//         color,
//         name: name || color,
//         index: gPaletteIndex++,
//     };
// }

// function pal0(color: string, name?: string): PaletteEntry {
//     gPaletteIndex = 0;
//     return palN(color, name);
// }

// interface Palette {
//     entries: PaletteEntry[];
// };

// // https://lospec.com/palette-list/the-lospec-snackbar
// export const gPalette: Palette = {
//     entries: [
//         pal0("#0b2458"),
//         palN("#0c5c67"),
//         palN("#12916b"),
//         palN("#27e931"),
//         palN("#fff34f"),
//         palN("#f6c23b"),
//         palN("#e97b21"),
//         palN("#d44b49"),
//         palN("#a21839"),
//         palN("#5d093a"),
//         palN("#3e0346"),
//         palN("#7d1475"),
//         palN("#ba2e89"),
//         palN("#f481b0"),
//         palN("#eeb8b4"),
//         palN("#9756c7"),
//         palN("#2c226e"),
//         palN("#11073a"),
//         palN("#2424af"),
//         palN("#4b7cdb"),
//         palN("#6acaf4"),
//         palN("#86ffed"),
//         palN("#fff7e9"),
//         palN("#ffd8a5"),
//         palN("#dd9c60"),
//         palN("#752314"),
//         palN("#4b050a"),
//         palN("#2c0008"),
//         palN("#35281f"),
//         palN("#3c3c3c"),
//         palN("#7f7f7f"),
//         palN("#b8a7b9"),
//     ],
// };

// // bringing colors together to create meaningful groups/variations.
// interface ColorGroup {
//     strongForeground: PaletteEntry;
//     strongBackground: PaletteEntry;
//     weakForeground: PaletteEntry;
//     weakBackground: PaletteEntry;
// };

// export interface CMSurfaceSpec {
//     //
// };

// export type CMSurfaceContextType = {
//     elevation: number,
//     // flags
//     selected: boolean, // the surface is selectable and selected.
//     enabled: boolean, // the item is enabled (vs. disabled = grayed out)
//     faded: boolean,
//     interactable: boolean, // the item is interactable; can be selected / enabled
//     //hovered: boolean,
// };

/**

ok so let's go through this again.
surfaces are like, backgrounds, divs, buttons, anything with background / border / foreground, and that can contain content.
i guess anything with a background and color scheme.

they can be styled pretty much any way, based on variables:
- elevation
- selected / not selected
- disabled / enabled
- faded / normal / emphasized
- interactable / noninteractable
- coloration (think tags)

deep elevation example
0 = page background; no surface
1 = white background, page content
2 = sub section like a header or event set list or whatever
3 = a button or tag
4 = a delete button on the tag

*/