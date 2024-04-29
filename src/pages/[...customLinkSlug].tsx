import { BlitzPage, useParams } from "@blitzjs/next";
import { NoSsr } from "@mui/material";
import db from "db";
import { useRouter } from "next/router";
import { CoerceToBoolean, IsNullOrWhitespace } from "shared/utils";
import { Markdown } from "src/core/components/RichTextEditor";
//import { CustomLinkRedirectType } from "src/core/db3/db3";
import * as db3 from "src/core/db3/db3";

export const getServerSideProps = async ({ params, req, query }) => {
    const slug = params.customLinkSlug?.join('/') || '';

    const link = await db.customLink.findUnique({ where: { slug } });

    if (!link || link.redirectType === db3.CustomLinkRedirectType.Disabled) {
        return { notFound: true };
    }

    // Record visit
    await db.customLinkVisit.create({
        data: {
            customLinkId: link.id,
            visitorIP: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
            userAgent: req.headers['user-agent'] || null,
            referrerURL: req.headers.referer || null,
            URI: req.url || null
        }
    });

    // Build the destination URL with query string
    let destinationURL = link.destinationURL;
    let hash = null;
    if (link.forwardQuery) {
        const baseUrl = new URL(link.destinationURL);
        Object.keys(query).filter(key => key !== "customLinkSlug").forEach(key => baseUrl.searchParams.append(key, query[key]));
        destinationURL = baseUrl.toString();

        hash = req.url.split('#')[1] || null; // Extract the hash from the original request URL. normally it's not sent to the server, but this at least preserves in case.
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
                props: { destinationURL, hash, intermediate: false }, // Client-side redirection
            };
        case db3.CustomLinkRedirectType.IntermediatePage:
            return {
                props: { intermediate: true, destinationURL, hash, intermediateMessage: link.intermediateMessage },
            };
        default:
            return { notFound: true };
    }
};

interface CustomLinkClientProps {
    destinationURL: string;
    intermediate: boolean;
    serverHash: string | null;
    intermediateMessage: string | null;
    forwardQuery: boolean;
};

const CustomLinkClient = (props: CustomLinkClientProps) => {
    const router = useRouter();
    const hashFragment = window.location.hash;
    let destinationURL = props.destinationURL;
    let hash = (hashFragment || props.serverHash); // favor the one on the client
    if (hash && props.forwardQuery) {
        destinationURL += hash;
    }

    if (props.intermediate) {
        return <div>
            <a href={destinationURL}>
                {IsNullOrWhitespace(props.intermediateMessage) ? "Click here to continue" : <Markdown markdown={props.intermediateMessage} />}
            </a>
        </div>;
    }

    void router.replace(destinationURL);
    return null;
};

const CustomURLSlug: BlitzPage<{ destinationURL?: string, intermediate?: boolean, serverHash?: string | null, intermediateMessage?: string | null, forwardQuery?: boolean | null }> = (props) => {
    if (!props.destinationURL) throw new Error();
    return <NoSsr>
        <CustomLinkClient
            destinationURL={props.destinationURL}
            intermediate={CoerceToBoolean(props.intermediate, true)}
            serverHash={props.serverHash || null}
            intermediateMessage={props.intermediateMessage || null}
            forwardQuery={CoerceToBoolean(props.forwardQuery, true)}
        />
    </NoSsr>;
};

export default CustomURLSlug;
