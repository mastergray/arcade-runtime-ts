// realizes: docs/ui-spec.md > §8 phone and tablet layout selection

export type PageLayout = "desktop" | "phone-portrait" | "phone-landscape";

export function layoutFor({ width, height }: { readonly width: number; readonly height: number; readonly touch: boolean }): PageLayout {
    // Geometry selects the skin; touch selects the controller's automatic default.
    if (height > width && width <= 1100) return "phone-portrait";
    if (width > height && height < 500) return "phone-landscape";
    return "desktop";
}
