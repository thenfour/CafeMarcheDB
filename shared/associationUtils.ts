import db, { Prisma } from "db";
import { ChangeAction, ChangeContext } from "shared/utils";

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
