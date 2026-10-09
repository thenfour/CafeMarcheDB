import { faker } from "@faker-js/faker";

export function probability(chance: number): boolean {
    return faker.number.float({ min: 0, max: 1 }) < chance;
}

export function choose<T>(items: readonly T[]): T {
    if (!items.length) {
        throw new Error("Cannot choose from an empty seed pool.");
    }
    return faker.helpers.arrayElement([...items]);
}

export function subset<T>(items: readonly T[], min: number, max: number): T[] {
    return faker.helpers.arrayElements([...items], { min: Math.min(min, items.length), max: Math.min(max, items.length) });
}

export function randomDate(start: Date, end: Date): Date {
    return new Date(faker.number.int({ min: start.valueOf(), max: end.valueOf() }));
}
