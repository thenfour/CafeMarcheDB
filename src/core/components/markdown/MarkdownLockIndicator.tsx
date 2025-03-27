import { LockOpen } from "@mui/icons-material";
import { WikiPageApi } from "./useWikiPageApi";



export const MarkdownLockIndicator = (props: { wikiApi: WikiPageApi | null }) => {
    if (!props.wikiApi) return <div className="MarkdownLockIndicator blank"></div>;
    return <div className="MarkdownLockIndicator blank"><LockOpen /></div>;
};