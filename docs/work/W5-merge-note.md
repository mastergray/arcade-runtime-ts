# W5 merge note

## `src/index.ts`

Add these two export declarations in the existing class and class-owned-type sections:

```ts
export { default as ArcadeDisplay } from "./ArcadeDisplay/ArcadeDisplay.js";
export { isArcadeDisplayConfig, isDisplayDocumentLike, isLayoutEvent, isResizeObserverConstructorLike, type ArcadeDisplayConfig, type DisplayDocumentLike, type ExitFullscreen, type LayoutEvent, type RequestFullscreen, type ResizeObserverConstructorLike, type ResizeObserverLike } from "./ArcadeDisplay/types.js";
```

No `tests/run.ts` entry is needed because the runner discovers `*.test.ts` files.

## Spec notes

No spec section appears incorrect. Section 7 names `LayoutEvent` without
spelling out its fields; this implementation preserves the DOS display's
horizontal `scale` and adds the `left`, `top`, `width` and `height` fields of
the centered `Rect` required by the W5 `layoutFor` signature.

The `"smooth"` config choice is applied as CSS `image-rendering: auto`, the
interoperable browser value for smooth interpolation; `"pixelated"` is applied
literally.

## Browser cases

Run:

```sh
npm run test:browser
```

`tests/browser/20-arcade-display.test.ts` starts an ephemeral localhost page,
transpiles the production modules it requests in memory, and loads
`FakeArcadeSession` from `tests/support/`. It needs no harness artifact or MAME
probe environment variable. If Chromium is absent, install it with
`npx playwright install chromium` and rerun the command.

Local result: all seven W5 browser cases passed under Chromium. The 22 existing
MAME probe cases skipped for their documented, unset local probe variables.

## Verification

```text
npm run check        pass
npm test             pass (235/235)
npm run test:browser pass (7 W5 cases; 22 unrelated probe skips)
```
