import { BlitzPage } from "@blitzjs/next";
import { useMutation, useQuery } from "@blitzjs/rpc";
import {
    Alert,
    Box,
    Button,
    Divider,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import React from "react";
import replaceMyCalendarSubscription from "src/auth/mutations/replaceMyCalendarSubscription";
import getMyCalendarSubscription from "src/auth/queries/getMyCalendarSubscription";
import { AppContextMarker } from "src/core/components/AppContext";
import { CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { useConfirm } from "src/core/components/ConfirmationDialog";
import DashboardLayout from "src/core/components/dashboard/DashboardLayout";
import { useSnackbar } from "src/core/components/SnackbarContext";
import { Permission } from "shared/permissions";
import { SettingMarkdown } from "@/src/core/components/SettingMarkdown";
import AppleIcon from "@mui/icons-material/Apple";
import GoogleIcon from "@mui/icons-material/Google";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import WindowIcon from "@mui/icons-material/Window";
import { CMTab, CMTabPanel } from "@/src/core/components/TabPanel";
import { useURLState } from "@/src/core/components/CMCoreComponents2";

type TTabId = "apple" | "google" | "outlook" | "other";

const ClientCalendarQrCode = ({ value }: { value: string }) => {
    const [dataUrl, setDataUrl] = React.useState<string | null>(null);
    const [failed, setFailed] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;
        setDataUrl(null);
        setFailed(false);
        void import("qrcode").then(qrCode => qrCode.toDataURL(value, {
            errorCorrectionLevel: "M",
            margin: 2,
            width: 240,
        })).then(result => {
            if (!cancelled) setDataUrl(result);
        }).catch(() => {
            if (!cancelled) setFailed(true);
        });
        return () => { cancelled = true; };
    }, [value]);

    if (failed) return <Typography color="text.secondary">
        The QR code could not be generated on this device. Use the Apple Calendar button instead.
    </Typography>;
    if (!dataUrl) return null;
    return <img
        alt="QR code containing your private calendar subscription link"
        height={240}
        src={dataUrl}
        width={240}
    />;
};

const CalendarPageContent = () => {
    const [subscription, { refetch }] = useQuery(getMyCalendarSubscription, null);
    const [replaceSubscription] = useMutation(replaceMyCalendarSubscription);
    const [showLink, setShowLink] = React.useState(false);
    const [selectedTab, setSelectedTab] = useURLState<TTabId>("caltab", "other");
    const [linkWasCopied, setLinkWasCopied] = React.useState(false);
    const confirm = useConfirm();
    const snackbar = useSnackbar();

    const copySubscriptionUrl = async () => {
        try {
            await navigator.clipboard.writeText(subscription.subscriptionUrl);
            setLinkWasCopied(true);
            snackbar.showSuccess("Private calendar link copied");
        } catch {
            setShowLink(true);
            snackbar.showError("Could not copy automatically. Select and copy the displayed link.");
        }
    };

    const replaceSubscriptionUrl = async () => {
        const confirmed = await confirm({
            title: "Replace your private calendar link?",
            description: "Your existing calendar subscriptions will stop updating. You can re-subscribe with the new link in your calendar app(s).",
        });
        if (!confirmed) return;

        try {
            await replaceSubscription(null);
            await refetch();
            setShowLink(false);
            snackbar.showSuccess("Private calendar link replaced");
        } catch {
            snackbar.showError("The private calendar link could not be replaced. Please try again.");
        }
    };

    return <div className="calPageContent">
        <div className="topLevelSurfaceStack">
            <div className="contentSection topLevelSurface">
                <div className="header">
                    {/* <CalendarIcon sx={{ fontSize: 40, mr: 1 }} /> */}
                    <h1>
                        Subscribe to the event feed in your calendar app
                    </h1>
                </div>
                <div className="content">
                    <p>
                        Automatically stay up-to-date with band events by
                        subscribing to the band calendar in
                        Outlook, Google Calendar, Apple Calendar, or any other calendar app.
                    </p>
                    <p>
                        Note: Your calendar is personalized to you and private; do not share the link.
                    </p>
                    {showLink && <TextField
                        fullWidth
                        inputProps={{ readOnly: true }}
                        label="Private calendar link"
                        value={subscription.subscriptionUrl}
                    />}
                </div>
                <div className="content">
                    {/* <Typography variant="h5">Choose your calendar app</Typography> */}
                    <CMTabPanel
                        className="calPageTabPanel"
                        handleTabChange={(x, newId) => setSelectedTab(newId as TTabId || "matrix")}
                        selectedTabId={selectedTab}
                    >
                        <CMTab thisTabId={"apple"} summaryIcon={<AppleIcon />} summaryTitle="Apple Calendar">
                            <h2>Instructions for Apple Calendar</h2>
                            <p>
                                On <strong>this device</strong>, use the button below.
                            </p>
                            <Button href={subscription.webcalUrl}>
                                Open in Apple Calendar
                            </Button>
                            <p>
                                To add the calendar on an <strong>iPhone or iPad</strong>{" "}
                                scan the QR code below
                            </p>
                            <div style={{ marginTop: "16px", display: "flex", justifyContent: "center" }}>
                                <ClientCalendarQrCode value={subscription.webcalUrl} />
                            </div>
                        </CMTab>
                        <CMTab thisTabId={"google"} summaryIcon={<GoogleIcon />} summaryTitle="Google Calendar">
                            <h2>Instructions for Google Calendar</h2>
                            <p>
                                <ol>
                                    <li>Open
                                        {" "}<a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer">Google Calendar</a>
                                        {" "}on a desktop computer.</li>
                                    <li>Next to "Other calendars," choose "Add other calendars," then "From URL."</li>
                                    <li>Copy and paste your private calendar link.</li>
                                </ol>
                            </p>
                            <Button onClick={copySubscriptionUrl}>Copy link for Google Calendar</Button>
                            {linkWasCopied && <Alert severity="success">Link copied; you can now paste it into your calendar app.</Alert>}
                        </CMTab>
                        <CMTab thisTabId={"outlook"} summaryIcon={<WindowIcon />} summaryTitle="Outlook">
                            <h2>Instructions for Outlook</h2>
                            <ol>
                                <li>Open Calendar on your desktop computer.</li>
                                <li>Choose "Add calendar", then "Subscribe from web."</li>
                                <li>Copy and paste your private calendar link.</li>
                            </ol>
                            <Button onClick={copySubscriptionUrl}>Copy link for Outlook</Button>
                            {linkWasCopied && <Alert severity="success">Link copied; you can now paste it into your calendar app.</Alert>}
                        </CMTab>
                        <CMTab thisTabId={"other"} summaryIcon={<MoreHorizIcon />} summaryTitle="Other">
                            <h2>Instructions for another calendar app</h2>
                            <p>
                                Look for “Add calendar subscription,” “From URL,” or “Internet calendar,” then
                                paste your private calendar link.
                            </p>
                            {/* <Alert severity="info">
                                Choose a subscription rather than importing or downloading an .ics file. An import
                                is only a snapshot. Calendar apps also choose their own refresh schedule, so updates
                                may take several hours to appear.
                            </Alert> */}
                            <Button onClick={copySubscriptionUrl}>Copy subscription link</Button>
                            {linkWasCopied && <Alert severity="success">Link copied; you can now paste it into your calendar app.</Alert>}

                        </CMTab>
                    </CMTabPanel>
                </div>
            </div>

            <CMSinglePageSurfaceCard>
                <div className="content">
                    <h3>Security and troubleshooting</h3>
                    <p>
                        You can replace your private calendar link at any time; this will
                        invalidate the previous link; your existing subscriptions will no longer update
                        and you can use a new link to subscribe to your calendar again.
                        Do this if your private calendar link was shared accidentally.
                    </p>
                    <Button color="error" onClick={replaceSubscriptionUrl}>Replace private link</Button>
                </div>
            </CMSinglePageSurfaceCard>
        </div>
    </div>;
};

const CalendarPage: BlitzPage = () => (
    <DashboardLayout title="Calendar subscription" basePermission={Permission.login}>
        <AppContextMarker name="calendar subscription page">
            <CalendarPageContent />
        </AppContextMarker>
    </DashboardLayout>
);

export default CalendarPage;
