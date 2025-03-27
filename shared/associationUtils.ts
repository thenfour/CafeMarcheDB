
// Returns a partial extract of oldValues, where the fields appear in newObject
export function getIntersectingFields(newValues: { [key: string]: any }, oldValues: { [key: string]: any }) {
    return Object.keys(newValues).reduce((acc, key) => {
        if (key in oldValues) {
            acc[key] = oldValues[key];
        }
        return acc;
    }, {} as { [key: string]: any });
}


function InAButNotB<T>(a: T[], b: T[], isEqualFn: (a: T, b: T) => boolean): T[] {
    return a.filter((item) => !b.some((element) => isEqualFn(item, element)));
};

function Intersection<T>(a: T[], b: T[], isEqualFn: (a: T, b: T) => boolean): { a: T, b: T }[] {
    return a.flatMap(itemA => {
        const matchingItems = b.filter(itemB => isEqualFn(itemA, itemB));
        return matchingItems.map(itemB => ({ a: itemA, b: itemB }));
    });
}
// returns changes required to update old associations to the new.
interface ChangePlan<T> {
    create: T[],
    delete: T[],
    potentiallyUpdate: { a: T, b: T }[],
    desiredState: T[],
};

export function ComputeChangePlan<T>(a: T[], b: T[], isEqualFn: (a: T, b: T) => boolean): ChangePlan<T> {
    const ret: ChangePlan<T> = {
        create: InAButNotB(b, a, isEqualFn),
        delete: InAButNotB(a, b, isEqualFn),
        potentiallyUpdate: Intersection(a, b, isEqualFn),
        desiredState: [...b], // make array copy
    };
    return ret;
};

export type CalculateChangesResult = {
    hasChanges: boolean;
    oldValues: any,
    newValues: any,
};

export const createEmptyCalculateChangesResult = (): CalculateChangesResult => ({
    oldValues: {},
    newValues: {},
    hasChanges: false,
});

// return an obj of fields which exist in both inputs, and are different.
export function CalculateChanges(oldObj: any, newObj: any): CalculateChangesResult {
    const result: CalculateChangesResult = {
        oldValues: {},
        newValues: {},
        hasChanges: false,
    };

    for (const prop in oldObj) {
        if (oldObj.hasOwnProperty(prop) && newObj.hasOwnProperty(prop)) {
            if (oldObj[prop] !== newObj[prop]) {
                result.oldValues[prop] = oldObj[prop];
                result.newValues[prop] = newObj[prop];
                result.hasChanges = true;
            }
        }
    }

    return result;
}
