import type { ComponentProps } from "react";
import Page from "../../backstage/wiki/[...slug]";

export { getServerSideProps } from "../../backstage/wiki/[...slug]";

export default function PlatformWikiPage(props: ComponentProps<typeof Page>) {
    return <Page {...props} />;
}
