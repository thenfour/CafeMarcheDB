
import React from "react";
import { StaticLocalizedStringKey } from "./staticLocalizedStringRegistry";

// // gets the string, no params
// // NB: synchronous!
// // NB: this fetches by static string key, not dynamic strings.
// const str = loc.getString("common.button.ok")
// const str = loc.getString({ key: "common.button.ok", params: [x, y, z] }) // with params
// const str = loc.getString("common.button.ok", [x, y, z]) // this might be worth supporting if the pattern is common.
// const str = loc.getStringDetail("common.button.ok") // returns a detailed struct with inspection info.

// // i am thinking to be explicit about how the string is used as well, so there's less
// // risk of mismatching markdown & raw.
// //
// // type error if that string is not a markdown string in the registry.
// const md = await loc.getMarkdown("common.generalConfirm.description")
// // type error if that string is not a plain string.
// const str = await loc.getMarkdown("common.generalConfirm.ok")

interface ILocale {
    getPlainString: (key: StaticLocalizedStringKey, params?: any[]) => string;
    getMarkdownString: (key: StaticLocalizedStringKey, params?: any[]) => string;
    refetch: () => void;
    setString: (key: StaticLocalizedStringKey, value: string) => Promise<void>;
};

export const useLocale = (): ILocale => {
    const memoizedLocale: ILocale = React.useMemo(() => {
        return {
            getPlainString: (key: StaticLocalizedStringKey, params?: any[]) => {
                // Implement your logic to get the plain string here
                return "";
            },
            getMarkdownString: (key: StaticLocalizedStringKey, params?: any[]) => {
                // Implement your logic to get the markdown string here
                return "";
            },
            refetch: () => {
                // Implement your logic to refetch the locale data here
            },
            setString: async (key: StaticLocalizedStringKey, value: string) => {
                // Implement your logic to set the string here
            },
        };
    }, []);
    return memoizedLocale;
};

