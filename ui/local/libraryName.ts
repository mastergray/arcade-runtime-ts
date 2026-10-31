// realizes: docs/ui-spec.md > §7 title bar (the library's name)

// The page's name in its title bars. A deployment names its library with a meta tag in the HTML it serves,
// <meta name="arcade-library-name" content="…">, and the development page keeps the default.
export const DEFAULT_LIBRARY_NAME = "Arcade Library";

export const libraryName = (): string => {
    const content = typeof document === "undefined" ? null : document.querySelector<HTMLMetaElement>('meta[name="arcade-library-name"]')?.content.trim();
    return content ? content : DEFAULT_LIBRARY_NAME;
};
