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

Without a preload, choose a family and machine, then pick or drop one or more zip
files. The page shows each basename and size before copying anything. **Confirm
and store** puts those files into `ArcadeRomStore` in this browser; the audit then
runs against their bare basenames before Start is enabled. Store entries can be
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
```

Archive paths are resolved relative to the config file. The browser receives
only their basenames and `/preload/<basename>` URLs; duplicate basenames after
case folding are rejected. Only the files named by that config are available
under `/preload/`, and there is no route that serves `res/` itself.

The page and its source show ROM basenames only. User-confirmed archives and save
overlays stay in that browser's origin-local IndexedDB and are never uploaded,
synced, linked or written into `dist/`. The harness contains no default ROM URL
and serves no ROM unless the developer explicitly allowlists it through a
private preload config.
