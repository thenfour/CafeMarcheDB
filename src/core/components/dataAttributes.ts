export type DataAttributes = {
    [attribute: `data-${string}`]: string | number | boolean | undefined;
};

export function pickDataAttributes(props: DataAttributes): DataAttributes {
    const attributes: DataAttributes = {};
    for (const key of Object.keys(props)) {
        if (key.startsWith("data-")) {
            // Object.keys loses the prefix type; the check above establishes it again.
            const attribute = key as `data-${string}`;
            attributes[attribute] = props[attribute];
        }
    }
    return attributes;
}
