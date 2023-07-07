
// returns changes required to update old associations to the new.
interface ChangePlan<T> {
    create: T[],
    delete: T[],
    desiredState: T[],
};
function InAButNotB<T>(a: T[], b: T[], isEqualFn: (a: T, b: T) => boolean): T[] {
    return a.filter((item) => !b.some((element) => isEqualFn(item, element)));
};

function ComputeChangePlan<T>(a: T[], b: T[], isEqualFn: (a: T, b: T) => boolean): ChangePlan<T> {
    const ret = {
        create: InAButNotB(b, a, isEqualFn),// creates are items in B but not in A.
        delete: InAButNotB(a, b, isEqualFn),// creates are items in B but not in A.
        desiredState: [...b], // make array copy
    };
    return ret;
};


export default {
    ComputeChangePlan,
};