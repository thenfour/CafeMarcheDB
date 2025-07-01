import React from "react";
import { formatMillisecondsToDHMS } from "shared/time";


export const AgeRelativeTo = ({ value1, value2 }: { value1: Date; value2: Date }) => {
    const delta = value1.valueOf() - value2.valueOf();
    const isPast = delta < 0;
    const formattedDuration = formatMillisecondsToDHMS(delta);

    if (formattedDuration === "--") {
        return <>now</>;
    }

    return <>{isPast ? `${formattedDuration} ago` : `in ${formattedDuration}`}</>;
};

export const AgeRelativeToNow = ({ value }: { value: Date }) => {
    const [now, setNow] = React.useState<Date>(new Date());

    React.useEffect(() => {
        const interval = setInterval(() => {
            setNow(new Date());
        }, 1000); // Update every second
        return () => clearInterval(interval);
    }, []);

    return <AgeRelativeTo value1={value} value2={now} />;
};

