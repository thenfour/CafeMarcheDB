import React from "react";
import Head from "next/head";
import { useRouter } from "next/router";

export const GenericPublicIndex: React.FC = () => {
    const router = useRouter();

    const destination = "/backstage";

    React.useEffect(() => {
        void router.replace(destination, undefined, { shallow: false });
    }, [router, destination]);

    return (
        <>
            <Head>
                <title>Redirecting…</title>
                <meta name="robots" content="noindex, nofollow" />
                {/* No-JS fallback: immediate meta refresh to the destination */}
                <meta httpEquiv="refresh" content={`10; url=${destination}`} />
            </Head>

            {/* Content for users while redirect occurs, and as a last-resort fallback */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "40vh", textAlign: "center", padding: 24 }}>
                <div>
                    <h1 style={{ marginBottom: 8 }}>Redirecting to Backstage…</h1>
                    <p style={{ marginTop: 0, color: "#666" }}>If you are not redirected automatically, use the button below.</p>
                    <p>
                        <a href={destination} style={{
                            display: "inline-block",
                            padding: "10px 16px",
                            background: "#1976d2",
                            color: "#fff",
                            borderRadius: 6,
                            textDecoration: "none",
                            fontWeight: 600,
                        }}>
                            Go to Backstage
                        </a>
                    </p>
                </div>
            </div>
        </>
    );
};

export default GenericPublicIndex;