import { Check, PushPin } from "@mui/icons-material";
import { ListItemIcon, MenuItem, Tooltip } from "@mui/material";
import { Prisma } from "@prisma/client";
import { EventRelevanceClassName, gEventRelevanceClass } from "../../db3/db3";
import { useSnackbar } from "../SnackbarContext";
import { useMutation } from "@blitzjs/rpc";
import setEventRelevanceClassOverride from "../../db3/mutations/setEventRelevanceClassOverride";
import { gNullValue } from "../../db3/shared/apiTypes";
import { useClientTelemetryEvent } from "../DashboardContext";
import { ActivityFeature } from "../featureReports/activityTracking";


interface RelevanceClassOverrideIndicatorProps {
    event: Prisma.EventGetPayload<{ select: { relevanceClassOverride } }>;
    colorStyle: "default" | "subtle";
}
export const RelevanceClassOverrideIndicator = ({ event, colorStyle }: RelevanceClassOverrideIndicatorProps) => {
    if (!event.relevanceClassOverride) return null;

    const messageMapping: Record<EventRelevanceClassName, string> = {
        "Future": "This event is pinned to the front page as a future event",
        "Hidden": "This event is explicitly hidden from the front page",
        "Ongoing": "This event is pinned to the front page as an ongoing event",
        "RecentPast": "This event is pinned to the front page as a recent past event",
        "Upcoming": "This event is pinned to the front page as an upcoming event",
    };

    const colorMapping: Record<EventRelevanceClassName, string> = {
        "Ongoing": "#4caf50",      // Green - currently happening
        "Upcoming": "#2196f3",     // Blue - coming soon
        "RecentPast": "#ff9800",   // Orange - just finished
        "Future": "#9c27b0",       // Purple - far future
        "Hidden": "#f44336",       // Red - hidden/excluded
    };

    // convert the value to the name.
    const relevanceClassName = Object.keys(gEventRelevanceClass).find(key => gEventRelevanceClass[key] === event.relevanceClassOverride) as EventRelevanceClassName;

    const message = messageMapping[relevanceClassName] || "This event is automatically pinned to the front page when it's relevant";
    const color = colorStyle === "default" ? (colorMapping[relevanceClassName] || "#0006") : "#0006";

    return (
        <Tooltip title={message}>
            <PushPin style={{ fill: color }} />
        </Tooltip>
    );
}

interface RelevanceClassOverrideMenuItemProps {
    event: Prisma.EventGetPayload<{ select: { relevanceClassOverride } }>;
    value: EventRelevanceClassName | null;
    onClick: () => void;
};

const RelevanceClassOverrideMenuItem = (props: RelevanceClassOverrideMenuItemProps) => {
    // renders a menu item that's checked if the event's relevance class override matches the value
    const isNullAndEqual = props.value === null && props.event.relevanceClassOverride === null;
    const isSelected = isNullAndEqual || props.event.relevanceClassOverride === gEventRelevanceClass[props.value!];
    return (
        <MenuItem onClick={props.onClick}>
            <ListItemIcon>
                {isSelected ? <Check /> : null}
            </ListItemIcon>
            {props.value || "(default)"}
        </MenuItem>
    );

}

interface RelevanceClassOverrideMenuItemGroupProps {
    event: Prisma.EventGetPayload<{ select: { id, relevanceClassOverride } }>;
    refetch: () => void;
    closeMenu: () => void;
};

export const RelevanceClassOverrideMenuItemGroup = (props: RelevanceClassOverrideMenuItemGroupProps) => {
    // renders an array of menu items for each relevance class override option
    const options: (EventRelevanceClassName | null)[] = [null, ...(Object.keys(gEventRelevanceClass) as EventRelevanceClassName[])];
    const [mut] = useMutation(setEventRelevanceClassOverride);
    const featureRecorder = useClientTelemetryEvent();
    const snackbar = useSnackbar();
    return options.map((relevanceClassName) => (
        <RelevanceClassOverrideMenuItem
            key={relevanceClassName === null ? gNullValue : relevanceClassName}
            event={props.event}
            value={relevanceClassName}
            onClick={async () => {
                void featureRecorder({
                    feature: ActivityFeature.event_change_relevance_class,
                    context: "MenuItem",
                });
                await snackbar.invokeAsync(async () => {
                    await mut({
                        eventId: props.event.id,
                        relevanceClassOverrideName: relevanceClassName,
                    });
                    void props.refetch();
                    void props.closeMenu();
                }, "Set relevance class override");
            }}
        />
    ));
}