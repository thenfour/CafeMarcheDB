import { IsNullOrWhitespace } from "@/shared/utils";

type InstrumentBase = {
    autoAssignFileLeafRegex: string | null;
};

interface AutoAssignInstrumentPartitionArgs<TInstrument extends InstrumentBase, TIdentity extends number | string> {
    allInstruments: TInstrument[];
    fileLeafWithoutExtension: string;
    getIdentity: (instrument: TInstrument) => TIdentity;
};

interface AutoAssignInstrumentPartitionRet<TIdentity extends number | string> {
    matchingInstrumentIds: TIdentity[];
};

export const AutoAssignInstrumentPartition = <TInstrument extends InstrumentBase, TIdentity extends number | string>({
    allInstruments,
    fileLeafWithoutExtension,
    getIdentity,
}: AutoAssignInstrumentPartitionArgs<TInstrument, TIdentity>): AutoAssignInstrumentPartitionRet<TIdentity> => {
    const matchingInstrumentIds: TIdentity[] = [];
    if (!fileLeafWithoutExtension) return {
        matchingInstrumentIds,
    };

    // Iterate over all instruments and check if the file leaf matches the regex
    allInstruments.forEach(instrument => {
        if (IsNullOrWhitespace(instrument.autoAssignFileLeafRegex)) {
            return;
        }
        const regex = new RegExp(instrument.autoAssignFileLeafRegex!, 'i'); // case insensitive
        if (regex.test(fileLeafWithoutExtension)) {
            matchingInstrumentIds.push(getIdentity(instrument));
        }
    });

    return {
        matchingInstrumentIds
    };
};

