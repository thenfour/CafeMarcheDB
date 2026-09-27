import { BlitzPage } from "@blitzjs/next";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { Box, NoSsr, Paper, Stack, Typography } from "@mui/material";
import db from "db";
import Head from "next/head";
import { useRouter } from "next/router";
import React from "react";
import { useBrand } from "shared/brandConfig";
import { CoerceToBoolean, IsNullOrWhitespace } from "shared/utils";
import { Markdown } from "src/core/components/markdown/Markdown";
import * as db3 from "src/core/db3/db3";
import { ServeAuthorizedFileDownload } from "src/core/db3/server/fileDownload";
import { gSSP } from "src/blitz-server";
import { CMButton } from "../core/components/CMCoreComponents2";

interface CustomLinkPageProps {
    destinationURL?: string;
    intermediate?: boolean;
    intermediateMessage?: string | null;
    forwardQuery?: boolean | null;
}

export const getServerSideProps = gSSP<CustomLinkPageProps>(async ({ params, req, res, query, ctx }) => {
    const slugParts = params?.customLinkSlug;
    const slug = Array.isArray(slugParts) ? slugParts.join('/') : slugParts || '';

    const link = await db.customLink.findUnique({ where: { slug }, include: { file: true } });

    if (!link || link.redirectType === db3.CustomLinkRedirectType.Disabled) {
        return { notFound: true };
    }

    // Record visit
    await db.customLinkVisit.create({
        data: {
            customLinkId: link.id,
            visitorIP: Array.isArray(req.headers['x-forwarded-for'])
                ? req.headers['x-forwarded-for'][0]
                : req.headers['x-forwarded-for'] || req.socket.remoteAddress,
            userAgent: req.headers['user-agent'] || null,
            referrerURL: req.headers.referer || null,
            URI: req.url || null
        }
    });

    // NORMALLY I would record the feature use here, but without a user ID or much client data
    // it's not the right place to record it.

    if (link.redirectType === db3.CustomLinkRedirectType.ServeFile) {
        if (!link.file) {
            res.statusCode = 404;
            res.end();
            return { props: {} };
        }
        await ServeAuthorizedFileDownload(req, res, ctx, link.file.storedLeafName);
        // Next skips page rendering after the stream has ended the response.
        return { props: {} };
    }

    if (!link.destinationURL) return { notFound: true };

    // Build the destination URL with query string
    let destinationURL = link.destinationURL;
    if (link.forwardQuery) {
        const baseUrl = new URL(link.destinationURL);
        Object.keys(query).filter(key => key !== "customLinkSlug").forEach(key => {
            const value = query[key];
            for (const part of Array.isArray(value) ? value : [value]) {
                if (part !== undefined) baseUrl.searchParams.append(key, part);
            }
        });
        destinationURL = baseUrl.toString();
    }

    // Handle redirection
    switch (link.redirectType as keyof typeof db3.CustomLinkRedirectType) {
        case db3.CustomLinkRedirectType.Permanent:
        case db3.CustomLinkRedirectType.Temporary:
            return {
                redirect: {
                    destination: destinationURL,
                    permanent: link.redirectType === db3.CustomLinkRedirectType.Permanent,
                },
            };
        case db3.CustomLinkRedirectType.Client:
            return {
                props: { destinationURL, forwardQuery: link.forwardQuery, intermediate: false }, // Client-side redirection
            };
        case db3.CustomLinkRedirectType.IntermediatePage:
            return {
                props: { intermediate: true, destinationURL, forwardQuery: link.forwardQuery, intermediateMessage: link.intermediateMessage },
            };
        default:
            return { notFound: true };
    }
});

interface CustomLinkClientProps {
    destinationURL: string;
    intermediate: boolean;
    intermediateMessage: string | null;
    forwardQuery: boolean;
};

const CustomLinkClient = (props: CustomLinkClientProps) => {
    const router = useRouter();
    const brand = useBrand();
    const destinationURL = props.forwardQuery ? props.destinationURL + window.location.hash : props.destinationURL;

    React.useEffect(() => {
        if (!props.intermediate) void router.replace(destinationURL);
    }, [destinationURL, props.intermediate, router]);

    if (props.intermediate) {
        return <>
            <Head><title>Continue to link</title></Head>
            <Box sx={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "background.default", px: 2, py: 4 }}>
                <Paper component="main" elevation={2} sx={{ width: "100%", maxWidth: 680, p: { xs: 3, sm: 4 }, overflowWrap: "anywhere" }}>
                    <Stack spacing={3}>
                        {brand.siteTitle && <Typography variant="overline" color="text.secondary">{brand.siteTitle}</Typography>}
                        <Typography component="h1" variant="h4">Continue to this link</Typography>
                        {IsNullOrWhitespace(props.intermediateMessage)
                            ? <Typography>Please review the destination before continuing.</Typography>
                            : <Markdown markdown={props.intermediateMessage} />}
                        <Box sx={{ borderTop: 1, borderColor: "divider", pt: 2 }}>
                            <Typography variant="caption" color="text.secondary">Destination</Typography>
                            <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>{destinationURL}</Typography>
                        </Box>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                            <CMButton component="a" color="info" href={destinationURL} endIcon={<ArrowForwardIcon />}>
                                Continue
                            </CMButton>
                        </Stack>
                    </Stack>
                </Paper>
            </Box>
        </>;
    }

    return null;
};

const CustomURLSlug: BlitzPage<CustomLinkPageProps> = (props) => {
    if (!props.destinationURL) throw new Error();
    return <NoSsr>
        <CustomLinkClient
            destinationURL={props.destinationURL}
            intermediate={CoerceToBoolean(props.intermediate, true)}
            intermediateMessage={props.intermediateMessage || null}
            forwardQuery={CoerceToBoolean(props.forwardQuery, true)}
        />
    </NoSsr>;
};

export default CustomURLSlug;
