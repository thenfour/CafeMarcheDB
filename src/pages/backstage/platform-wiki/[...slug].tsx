import type { ComponentProps } from "react";
import Page from "../wiki/[...slug]";

export { getServerSideProps } from "../wiki/[...slug]";

export default function PlatformWikiPage(props: ComponentProps<typeof Page>) {
    return <Page {...props} />;
}
