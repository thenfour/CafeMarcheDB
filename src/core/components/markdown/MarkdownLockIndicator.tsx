import React from "react";
import { Lock, LockOpen } from "@mui/icons-material";
import { WikiPageApi } from "./useWikiPageApi";
import { CircularProgress, Tooltip } from "@mui/material";
import { gIconMap } from "src/core/db3/components/IconMap";

export const MarkdownLockIndicator = (props: { wikiApi: WikiPageApi | null }) => {
    const classes: string[] = ["MarkdownLockIndicator"];
    let icon: React.ReactNode = null;
    let text: React.ReactNode = null;
    let iconTooltip: React.ReactNode = null;

    if (props.wikiApi) {
        if (props.wikiApi.lockStatus.isRevisionConflict) {
            classes.push("revisionConflict");
            icon = gIconMap.Error();
            text = iconTooltip = "A newer version of this article has been saved since you started editing it.";
        } else {
            if (!props.wikiApi.lockStatus.isLocked) {
                classes.push("notLocked");
                icon = <LockOpen />;
                iconTooltip = "Not locked for editing.";
            } else {
                if (props.wikiApi.lockStatus.isLocked) {
                    if (!props.wikiApi.lockStatus.isLockedInThisContext) {
                        classes.push("lockedByDifferentContext");
                        icon = <Lock />;
                        text = iconTooltip = "This article is being edited by another user.";
                    }
                    else if (props.wikiApi.lockStatus.isLockedInThisContext) {
                        classes.push("lockedInThisContext");
                        icon = <Lock />;
                        iconTooltip = "You have locked this article for editing.";
                    }
                }
            }
        }
    }
    return <div className={classes.join(" ")}>
        <div className="textLabel">
            {text}
        </div>
        {props.wikiApi?.networkPending &&
            <Tooltip disableInteractive title={"Loading..."}>
                <div className="icon" style={{ color: "black" }}>
                    <CircularProgress size="1em" color="inherit" />
                </div>
            </Tooltip>
        }
        <Tooltip disableInteractive title={iconTooltip}>
            <div className="icon">{icon}</div>
        </Tooltip>

    </div >;
};

