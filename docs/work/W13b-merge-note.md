# W13b merge note — harness cabinet

## Delivered

- The harness now composes `ArcadeCabinet.init` with `ArcadeStorage` keyed by
  `<family>/<machine>`, one browser-local `ArcadeRomStore`, default keyboard and
  gamepad controls, and an autosave checkbox that defaults off.
- The picker and drop zone show basename and size before confirmation. Confirmed
  zips are stored locally, listed with per-entry removal and whole-store clearing,
  then supplied to the cabinet as bare basenames. The preload path remains
  URL-backed through the server allowlist.
- The pre-start audit lists every archive with its game, parent, BIOS, samples or
  device role. Start remains gated on an `ok` report.
- The corner menu supplies fullscreen, mute/unmute, soft and hard reset, quick
  save/load, persist, clear saves, keyboard/gamepad toggles, and connected-pad
  assignments. Persist status distinguishes saved changes from no changes.
- `OVERLAY_INCOMPATIBLE` leaves save storage untouched, opens the menu, and waits
  for the user to click **Clear saves and retry**.
- `tests/browser/34-harness-cabinet.test.ts` uses two generated synthetic zips,
  real IndexedDB stores, `ArcadeCabinet`, the real display, and a scripted public
  adapter (no `FakeArcadeSession`). It covers confirmation, basename resolution,
  role-aware audit, explicit incompatible-save recovery, a rendered frame,
  removal and store clearing. Its environment-gated case covers production
  preload start, quick save, persist, clear saves and hard restart.

## Integrator-owned package line

The required line is already present from W13a, so this branch did not edit
`package.json`:

```json
"harness": "node --import tsx scripts/serve-harness.ts"
```

## Running the harness

Picker mode:

```sh
npm run harness
```

Private preload mode:

```sh
npm run harness -- --preload res/preload.json
```

Open the printed loopback URL. In picker mode, choose the family and machine,
pick or drop lawful zip files, review their basenames and sizes, then click
**Confirm and store**. In preload mode, the sanitized config is audited and an
autostart config waits for one gesture.

## Verification

- `npm run check`: passed.
- `npm test`: passed (482 passed, 2 skipped).
- `npm run test:browser`: passed (23 passed, 26 environment-gated skips),
  including the full synthetic picker/store/cabinet case.
- `ARCADE_PRELOAD_CONFIG=res/preload.json npm run test:browser`: attempted, but
  the sandbox refused every test page listener with
  `listen EPERM: operation not permitted 127.0.0.1` before Chromium could run.
  The integrator should rerun that exact command in an environment that permits
  loopback listeners.

The required hand runs were attempted with both `npm run harness` and
`npm run harness -- --preload res/preload.json`; the sandbox refused the
loopback listener in both cases. Consequently no family could be started by hand
inside this sandbox. The intended production hand run is the Neo Geo family, and
the configured build plus both private inputs were verified present without
printing their identities. The two-zip picker flow did complete in Chromium with
generated lawful synthetic archives before the listener restriction recurred.
The integrator should repeat both commands above, start the Neo Geo preload, and
also confirm the picker path with two lawful local zips.

## Spec review

No incorrect spec section was found.
