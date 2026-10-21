# W13c merge note

## Delivered

- The harness fetches and validates the selected build's per-machine metadata.
- Metadata-backed BIOS and DIP selectors apply matching preload choices, mark defaults, and warn when preload values cannot be matched.
- Only non-default DIP choices are sent. Defaults remain page state, reset to an empty selection map, and are never persisted with overlays.
- Selector changes leave a running session intact until the user chooses **Restart with these switches**.
- `tests/browser/37-harness-selectors.test.ts` covers the synthetic selector/start/restart flow and adds an environment-gated production start assertion.

## Start payload

In the synthetic case, selecting the alternate BIOS and one non-default setting sends a start config equivalent to:

```ts
{
    bios: "alternate-bios",
    dipswitches: { "Cabinet Tempo": "Quick" },
}
```

The second switch remains at its default and is absent. After **Reset to defaults**, the restart sends the same BIOS with `dipswitches: {}`.

## Verification

- `npm run check` passes.
- `npm test` passes: 490 passed, 0 failed, 2 skipped.
- A separate strict TypeScript check of `harness/harness.ts` passes.
- Both required environment-gated browser runs were attempted. This sandbox rejects every test server before page execution with `listen EPERM: operation not permitted 127.0.0.1`, so the two provided ignored preload configurations must be rerun by the integrator outside this sandbox.

## Integrator note

No contract amendment is needed. The spec's §16.3 W16 row and §16.4 dependency graph are stale: they still assign harness selectors to W16 and do not record the W13c split. The W13c brief's write-set override is correct and those integrator-owned sections should be updated to match it.
