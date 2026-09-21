import { IsNullOrWhitespace } from "@/shared/utils";

type InstrumentBase = {
    id: number;
    autoAssignFileLeafRegex: string | null;
};

interface AutoAssignInstrumentPartitionArgs<TInstrument extends InstrumentBase> {
    allInstruments: TInstrument[];
    fileLeafWithoutExtension: string;
};

interface AutoAssignInstrumentPartitionRet {
    matchingInstrumentIds: number[];
};

export const AutoAssignInstrumentPartition = <TInstrument extends InstrumentBase>({ allInstruments, fileLeafWithoutExtension }: AutoAssignInstrumentPartitionArgs<TInstrument>): AutoAssignInstrumentPartitionRet => {
    const matchingInstrumentIds: number[] = [];
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
            matchingInstrumentIds.push(instrument.id);
        }
    });

    return {
        matchingInstrumentIds
    };
};

