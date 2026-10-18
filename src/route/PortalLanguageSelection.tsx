import { ErrorOutline } from "@mui/icons-material";
import React from "react";
import { usePresentation } from "src/locale/components/PresentationProvider";
import { useLocale } from "src/locale/components/useLocale";
import { CMChip, CMChipProps } from "../core/components/CMChip";
import { CMSingleSelect } from "../core/components/select/CMSelect";
import { CMSelectDisplayStyle } from "../core/components/select/SelectionField";
import { useCmdbRouter } from "./useCmdbRouter";
import { IsNullOrWhitespace } from "@/shared/utils";

export type LanguageChipProps = React.PropsWithChildren<CMChipProps> & {
    // we have to choose different colors depending where it's used.
    colorStyle?: "menu" | "dialog";
};

export const LanguageChip = (props: LanguageChipProps) => {
    const { colorStyle, ...rest } = props;
    return <CMChip
        size="small"
        shape="rectangle"
        className="language-chip"

        {...rest}
        style={colorStyle === "menu" ? {
            "--color-foreground": "var(--contrast-text)",
            "--color-background": "transparent",
            "--color-border-style": "none",
        } as any : undefined}
    >
        {props.children}
    </CMChip>;
};

export const AlertIndicator = (props: React.PropsWithChildren<{}>) => {
    return <div className="alert-indicator"><ErrorOutline /></div>;
};

export function PortalLanguageSelection() {
    const presentation = usePresentation();
    const locale = useLocale();
    const router = useCmdbRouter();
    const [switching, setSwitching] = React.useState(false);
    const [failed, setFailed] = React.useState(false);
    const data = presentation.data;
    const selected = data?.input.routeLocale ?? "";
    const available = data?.localization.availability;
    const choices = [...(presentation.bandPublicId ? available?.band : available?.global) ?? []];

    // use default browser locale as fallback. it's important that we always show something.
    const formattingLocale = presentation.data?.localization.formattingLocale || navigator.language;
    const displayIetf = IsNullOrWhitespace(selected) ? formattingLocale : selected;

    async function selectLanguage(value: string) {
        setSwitching(true);
        setFailed(false);
        try {
            if (!await router.switchLanguage(value || null)) {
                setFailed(true);
            }
        } catch {
            setFailed(true);
        } finally {
            setSwitching(false);
        }
    }


    // even though we support multiple locales with  the same lang (fr-FR, fr-BE etc),
    // don't show that to the user. 
    function parseIetfLang(option: string) {
        return option.split("-")[0]!;
    }

    // renderChoice tooltip should show the full locale code, and full language name IN that language.
    function getTooltip(option: string) {
        try {
            const localeCode = option; // full ietf
            const languageName = new Intl.DisplayNames([parseIetfLang(option)], { type: "language" }).of(parseIetfLang(option));
            return `${languageName} (${localeCode})`;
        } catch {
            return option;
        }
    }

    return <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "8px", marginRight: "8px" }}>
        <CMSingleSelect
            displayStyle={CMSelectDisplayStyle.SelectedAsDialogTrigger}
            readonly={switching}
            value={parseIetfLang(displayIetf)}
            getOptions={() => choices}
            getOptionInfo={option => ({ id: option, label: option, value: option })}
            renderOption={(option) => getTooltip(option)} // dialog.
            renderChoice={(props) => (<LanguageChip
                colorStyle="menu"
                choice={props}
                tooltip={getTooltip(props.item)}
            >
                {parseIetfLang(props.item)}
            </LanguageChip>)}
            onChange={selectLanguage}
            dialogTitle={locale.getPlainString("dashboard.language.select")}
        />
        {failed && <AlertIndicator />}
    </div>;
}
