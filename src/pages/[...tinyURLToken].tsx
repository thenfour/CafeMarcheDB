import { BlitzPage, useParams } from "@blitzjs/next";
import { useRouter } from "next/router";
import { DebugCollapsibleText } from "src/core/components/CMCoreComponents2";
import React from "react";


function fetchDestinationUrl(slug: string): string | null {
    // This should interact with your database to find the URL associated with the slug
    // Example:
    switch (slug) {
        case 'abc123':
            return 'https://example.com';
        case 'xyz789':
            return 'https://anotherexample.com';
        default:
            return null; // Return null if no URL is found for the slug
    }
}


export const getServerSideProps = async ({ params, query }) => {
    const token = params?.tinyURLToken as string[];
    const slug = token.join('/'); // Handle slugs that might include forward slashes

    // Fetch the actual destination URL from your database
    const baseDestinationUrl = fetchDestinationUrl(slug);

    if (!baseDestinationUrl) {
        return { props: {} }; // No URL found, return empty props
    }

    // Append query string parameters to the destination URL
    const urlSearchParams = new URLSearchParams(query as { [key: string]: string });
    urlSearchParams.delete('tinyURLToken'); // Remove the token key if it's accidentally included in query

    const destinationUrl = `${baseDestinationUrl}?${urlSearchParams}`;

    return { props: { destinationUrl } };
}

const RootDynRedirectPage: BlitzPage = ({ destinationUrl }: { destinationUrl?: string }) => {
    const router = useRouter();
    const [destURL, setDestURL] = React.useState<string>("");

    React.useEffect(() => {
        if (destinationUrl) {
            const hashFragment = window.location.hash;
            setDestURL(destinationUrl + hashFragment);
            //window.location.href = destinationUrl + hashFragment;
        } else {
            //router.push('/404');
        }
    }, [destinationUrl, router]);

    return <div>
        {destURL}
        {/* <DebugCollapsibleText text={JSON.stringify(props, undefined, 2)} caption="props" /> */}
        {/* <DebugCollapsibleText text={JSON.stringify(params, undefined, 2)} caption="params" /> */}
    </div>;
}

export default RootDynRedirectPage;
