
// array sort by selector
export function sortBy<T, U>(array: T[], selector: (item: T) => U): T[] {
    return array.slice().sort((a, b) => {
        const aValue = selector(a);
        const bValue = selector(b);

        if (aValue < bValue) {
            return -1;
        }
        if (aValue > bValue) {
            return 1;
        }
        return 0;
    });
}

// uberspace cannot do toSorted. use this.
export function toSorted<T>(array: T[], compareFn?: (a: T, b: T) => number): T[] {
    return array.slice().sort(compareFn);
}

// export function isOneOf<T>(value: T, ...values: T[]): boolean {
//     return values.includes(value);
// }

/**
 * `values` can only contain members of the union type of `value`.
 * The return type is a type-predicate, so it also narrows `value`
 * when the result is `true`.
 */
export function isOneOf<
    T,                       // inferred solely from the first argument
    V extends readonly T[]   // every element of `values` must be a `T`
>(
    value: T,
    ...values: V
): value is V[number] {
    // runtime implementation is trivial
    return (values as readonly unknown[]).includes(value as unknown);
}



// https://stackoverflow.com/questions/1232040/how-do-i-empty-an-array-in-javascript
export function clearArray(array) {
    while (array.length > 0) {
        array.pop();
    }
    return array;
}

export function arraysContainSameValues<T>(arr1: T[], arr2: T[]): boolean {
    if (arr1.length !== arr2.length) {
        return false;
    }

    const sortFunc = (a: T, b: T) => {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
    };

    const sortedArr1 = [...arr1].sort(sortFunc);
    const sortedArr2 = [...arr2].sort(sortFunc);

    for (let i = 0; i < sortedArr1.length; i++) {
        if (sortedArr1[i] !== sortedArr2[i]) {
            return false;
        }
    }

    return true;
}



export function isEmptyArray(obj: any) {
    if (!Array.isArray(obj)) return false;
    return 0 === ((obj as any[]).length);
}

export function moveItemInArray<T>(array: T[], oldIndex: number, newIndex: number): T[] {
    if (oldIndex === newIndex) {
        return array; // No need to move if oldIndex and newIndex are the same
    }

    if (oldIndex < 0 || oldIndex >= array.length || newIndex < 0 || newIndex >= array.length) {
        throw new Error("Invalid oldIndex or newIndex");
    }

    const itemToMove = array[oldIndex]!;
    const newArray = [...array]; // Create a copy of the original array

    // Remove the item from the old position
    newArray.splice(oldIndex, 1);

    // Insert the item at the new position
    newArray.splice(newIndex, 0, itemToMove);

    return newArray;
}

export function existsInArray<T>(
    array: T[],
    id: T,
    compareFn: (a: T, b: T) => boolean = (a, b) => a === b
): boolean {
    const index = array.findIndex(item => compareFn(item, id));
    return (index !== -1);
}

// adds or removes a value in an array. ordering is assumed to not matter.
// returns a new array with the change made.
export function toggleValueInArray<T>(
    array: T[],
    id: T,
    compareFn: (a: T, b: T) => boolean = (a, b) => a === b
): T[] {
    const index = array.findIndex(item => compareFn(item, id));
    const newArray = [...array];  // Create a copy of the array to avoid mutating the original array

    if (index === -1) {
        newArray.push(id);
    } else {
        newArray.splice(index, 1);
    }

    return newArray;
};


export function distinctValuesOfArray<T>(items: T[], areEqual: (a: T, b: T) => boolean): T[] {
    return items.reduce<T[]>((acc, current) => {
        if (!acc.some(item => areEqual(item, current))) {
            acc.push(current);
        }
        return acc;
    }, []);
};



export function assertIsNumberArray(value: any): asserts value is number[] {
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'number')) {
        console.log(`{ the following value is not a number array`);
        console.log(value);
        console.log(`}`);
        throw new Error('Value is not a number array; see console');
    }
}

export function assertIsStringArray(value: any): asserts value is string[] {
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
        console.log(`{ the following value is not a string array`);
        console.log(value);
        console.log(`}`);
        throw new Error('Value is not a string array');
    }
}


export function groupByMap<T, K, V = T>(
    array: T[],
    getKey: (item: T) => K,
    valueSelector?: (item: T) => V
): Map<K, V[]> {
    return array.reduce((result, item) => {
        const key = getKey(item);
        if (!result.has(key)) result.set(key, []);

        const value = valueSelector ? valueSelector(item) : (item as unknown as V);
        result.get(key)!.push(value);

        return result;
    }, new Map<K, V[]>());
}

// like filter() but
// returns both matching & nonmatching items.
export function partition<TRow>(
    array: TRow[],
    predicate: (row: TRow) => boolean
): [TRow[], TRow[]] {
    const matching: TRow[] = [];
    const notMatching: TRow[] = [];

    for (const item of array) {
        if (predicate(item)) {
            matching.push(item);
        } else {
            notMatching.push(item);
        }
    }

    return [matching, notMatching];
}


export function removeNullishItems<T>(
    arr: readonly T[],
): NonNullable<T>[] {
    return arr.filter(
        (value): value is NonNullable<T> => value != null, // `!=` matches both null and undefined
    );
}