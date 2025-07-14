import { Timing } from "@/shared/time";
import { CMChip, CMChipProps } from "../CMChip";
import { gSwatchColors, StandardVariationSpec } from "../color/palette";


export const TimingChip = ({ value, tooltip, children }: React.PropsWithChildren<{ value: Timing, tooltip: string }>) => {
    const configMap: { [key in Timing]: CMChipProps } = {
        [Timing.Past]: { color: gSwatchColors.light_gray, variation: { ...StandardVariationSpec.Weak, fillOption: "hollow" }, shape: "rectangle" },
        [Timing.Present]: { color: gSwatchColors.orange, variation: { ...StandardVariationSpec.Weak, fillOption: "hollow" }, shape: "rectangle" },
        [Timing.Future]: { color: gSwatchColors.purple, variation: { ...StandardVariationSpec.Weak, fillOption: "hollow" }, shape: "rectangle" },
    };
    return <CMChip {...configMap[value]} tooltip={tooltip}>{children}</CMChip>;
}
