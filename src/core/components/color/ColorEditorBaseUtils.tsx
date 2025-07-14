
function ff(n: number | undefined) {
    if (n === undefined) return "00";
    return ('0' + Math.floor(n).toString(16)).slice(-2);
}

// r g b are 0-255
export const rgbToCssString = (r: number, g: number, b: number, a01: number): string => {
    if (a01 >= 1.0) {
        return `#${ff(Math.round(r))}${ff(Math.round(g))}${ff(Math.round(b))}`;
    }
    return `#${ff(Math.round(r))}${ff(Math.round(g))}${ff(Math.round(b))}${ff(Math.round(a01 * 255))}`;
};

// h = 0-360
// s = 0-100
// l = 0-100
export const hslToCssString = (h: number, s: number, l: number, a01: number): string => {
    if (a01 >= 1.0) {
        return `hsl(${Math.round(h)}deg ${Math.round(s)}% ${Math.round(l)}%)`;
    }
    return `hsl(${Math.round(h)}deg ${Math.round(s)}% ${Math.round(l)}% / ${Math.round(a01 * 100)}%)`;
};
