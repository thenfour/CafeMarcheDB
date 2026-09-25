import { useMutation } from "@blitzjs/rpc";
import { Check, PushPin } from "@mui/icons-material";
import { ListItemIcon, MenuItem, Tooltip } from "@mui/material";
import { Prisma } from "@prisma/client";
import type { EventPublicId } from "shared/publicId";
import setEventRelevanceClassOverride from "../../db3/mutations/setEventRelevanceClassOverride";
import { EventRelevanceClassName, gEventRelevanceClass } from "../../db3/shared/eventRelevance";
import { useClientTelemetryEvent } from "../dashboardContext/DashboardContext";
import { ActivityFeature } from "../featureReports/activityTracking";
import { useSnackbar } from "../SnackbarContext";


interface RelevanceClassOverrideIndicatorProps {
    event: Prisma.EventGetPayload<{ select: { relevanceClassOverride } }>;
    colorStyle: "default" | "subtle";
}
export const RelevanceClassOverrideIndicator = ({ event, colorStyle }: RelevanceClassOverrideIndicatorProps) => {
    if (!event.relevanceClassOverride) return null;

    const messageMapping: Record<EventRelevanceClassName, string> = {
        "Pinned": "Pin this event to the front page",
        "Future": "This event is pinned to the front page as a future event",
        "TBD": "This event is pinned to the front page as a TBD event",
        "Hidden": "This event is explicitly hidden from the front page",
        "Ongoing": "This event is pinned to the front page as an ongoing event",
        "RecentPast": "This event is pinned to the front page as a recent past event",
        "Upcoming": "This event is pinned to the front page as an upcoming event",
    };

    const colorMapping: Record<EventRelevanceClassName, string> = {
        "Pinned": "#ffeb3b",       // Yellow - explicitly pinned
        "Ongoing": "#4caf50",      // Green - currently happening
        "Upcoming": "#2196f3",     // Blue - coming soon
        "RecentPast": "#ff9800",   // Orange - just finished
        "Future": "#9c27b0",       // Purple - far future
        "Hidden": "#f44336",       // Red - hidden/excluded
        "TBD": "#607d8b",          // Grey - to be determined
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

type MenuItemSpec = {
    key: string;
    value: EventRelevanceClassName | null;
    label: string;
};

interface RelevanceClassOverrideMenuItemProps {
    event: Prisma.EventGetPayload<{ select: { relevanceClassOverride } }>;
    menuItemSpec: MenuItemSpec;
    onClick: () => void;
};

const RelevanceClassOverrideMenuItem = (props: RelevanceClassOverrideMenuItemProps) => {
    // renders a menu item that's checked if the event's relevance class override matches the value
    const isNullAndEqual = props.menuItemSpec.value === null && props.event.relevanceClassOverride === null;
    const isSelected = isNullAndEqual || props.event.relevanceClassOverride === gEventRelevanceClass[props.menuItemSpec.value!];
    return (
        <MenuItem onClick={props.onClick}>
            <ListItemIcon>
                {isSelected ? <Check /> : null}
            </ListItemIcon>
            {props.menuItemSpec.label}
        </MenuItem>
    );

}

interface RelevanceClassOverrideMenuItemGroupProps {
    event: { publicId: EventPublicId; relevanceClassOverride: number | null };
    refetch: () => void;
    closeMenu: () => void;
};

export const RelevanceClassOverrideMenuItemGroup = (props: RelevanceClassOverrideMenuItemGroupProps) => {
    // renders an array of menu items for each relevance class override option
    const options: MenuItemSpec[] = [];
    const [mut] = useMutation(setEventRelevanceClassOverride);
    const featureRecorder = useClientTelemetryEvent();
    const snackbar = useSnackbar();

    const isExplicitlyPinned = props.event.relevanceClassOverride === gEventRelevanceClass.Pinned;
    const isExplicitlyHidden = props.event.relevanceClassOverride === gEventRelevanceClass.Hidden;
    const isOtherwiseOverridden = !isExplicitlyPinned && !isExplicitlyHidden && props.event.relevanceClassOverride !== null;
    const hasNoOverrides = props.event.relevanceClassOverride === null;

    // new UX will show only
    // - Pin/unpin to front page
    // - Hide from front page -- only if not explicitly overridden

    // so you can only see either:
    // (if not explicitly overridden)
    // - Pin this event to front page
    // - Hide this event from front page
    // Or,
    // - Unpin this event from front page (if explicitly pinned)
    // or,
    // - Unhide this event from front page (if explicitly hidden)
    // or for any other explicit override,
    // - Reset relevance overrides (new version you should never see this because other overrides are not user-facing)

    if (isExplicitlyPinned) {
        options.push({ key: "unpin", value: null, label: "Unpin from front page" });
    }
    if (isExplicitlyHidden) {
        options.push({ key: "unhide", value: null, label: "Unhide from front page" });
    }
    if (isOtherwiseOverridden) {
        options.push({ key: "reset", value: null, label: "Reset relevance overrides" });
    }
    if (hasNoOverrides) {
        options.push({ key: "pin", value: "Pinned", label: "Pin to front page" });
        options.push({ key: "hide", value: "Hidden", label: "Hide from front page" });
    }

    return options.map((item) => (
        <RelevanceClassOverrideMenuItem
            key={item.key}
            event={props.event}
            menuItemSpec={item}
            onClick={async () => {
                void featureRecorder({
                    feature: ActivityFeature.event_change_relevance_class,
                    context: "MenuItem",
                });
                await snackbar.invokeAsync(async () => {
                    await mut({
                        eventId: props.event.publicId,
                        relevanceClassOverrideName: item.value,
                    });
                    void props.refetch();
                    void props.closeMenu();
                }, "Set relevance class override");
            }}
        />
    ));
}
