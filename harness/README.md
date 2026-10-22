# Developer harness

The harness is a local consumer page for family builds and user-supplied ROM
archives. It is a test aid, not a deployment, and writes nothing to `dist/`.

After the `harness` package script has been added by the integrator, start the
page without private inputs:

```sh
npm run harness
```

To audit and start one locally configured machine, copy
`harness/preload.example.json` to an ignored location, replace every placeholder
with your own lawful local inputs, and pass that file explicitly:

```sh
npm run harness -- --preload res/preload.json
```

Open the printed URL. An autostart config waits for one click anywhere before it
starts, so that click can also serve as the browser audio gesture.

Without a preload, drop or choose zip files anywhere on the page. Each zip is
identified by its basename against the machine lists of every served family
build (`?family=neogeo`, repeatable or comma-separated, limits that index to the
builds named), and a card shows the game's title, its family build and every
companion zip it still needs by name. **Store and check** on a card, or **Store
all and check**, puts those files into `ArcadeRomStore` in this browser and runs
the audit at once; an ok card gets its own **Start**. Game settings and the
system version, where a game has them, fold out on the card. Saved files can be
removed individually or cleared together. Clearing the ROM store does not clear
save data, and clearing saves does not touch the ROM store.

The corner menu provides fullscreen, sound, reset, quick-state, persistence,
keyboard and gamepad controls. Autosave is off unless its checkbox is selected.
If a saved overlay is incompatible, the page leaves it in place and offers a
separate **Clear saves and retry** action.

Available server options are:

```text
--host <host>       listener host (default 127.0.0.1)
--port <port>       listener port (default 8787)
--build-root <dir>  family build root served under /mame/ (default dist/mame)
--preload <file>    private preload JSON
--page <file>       extra local HTML page served at /<name> (repeatable)
```

`--page res/device-test.html` serves exactly that file at `/device-test` and
nothing beside it, so a device-capability page kept under the ignored `res/` tree
can be opened from another device on the LAN together with `--host 0.0.0.0`.
Nothing under `res/` is reachable otherwise, and a page may not shadow a harness
route.

Archive paths are resolved relative to the config file. The browser receives
only their basenames and `/preload/<basename>` URLs; duplicate basenames after
case folding are rejected. Only the files named by that config are available
under `/preload/`, and there is no route that serves `res/` itself.

The page and its source show ROM basenames only. User-confirmed archives and save
overlays stay in that browser's origin-local IndexedDB and are never uploaded,
synced, linked or written into `dist/`. The harness contains no default ROM URL
and serves no ROM unless the developer explicitly allowlists it through a
private preload config.
