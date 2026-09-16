import { formatEventDateRange } from "shared/dateTimePresentation";
import type { DateTimeRange } from "shared/time";
import { useDashboardContext } from "../dashboardContext/DashboardContext";

export function EventDateRangeText({ range }: { range: DateTimeRange }) {
    const dashboardContext = useDashboardContext();
    return <>{
        formatEventDateRange(range, dashboardContext.eventDatePresentation)
    }
    </>;
}
