
// NB: must be serializable
export interface ColorBlenderParamsBundle {
    c: string[], // 3 colors A B C, or 4 colors A B C D.
    m: string, // method
    z: number, // grid dimension size
    op: string, // which operation was used to generate the resulting gradient.
};

export function ParseParamBundle(x: string | null): ColorBlenderParamsBundle | null {
    if (x == null) return null;
    try {
        const parsedData = JSON.parse(x);

        if (
            Array.isArray(parsedData.c) &&
            parsedData.c.every((color) => typeof color === 'string') &&
            typeof parsedData.m === 'string' &&
            typeof parsedData.z === 'number' &&
            typeof parsedData.op === 'string'
        ) {
            return parsedData;
        } else {
            return null;
        }
    } catch (error) {
        return null;
    }
}
