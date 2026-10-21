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
starts, so that click can also serve as the browser audio gesture. Keyboard play
uses `DEFAULT_KEYBOARD_MAP`.

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

Without `--preload`, the page still lists family directories containing a
`build.json`. Local file picking arrives with W13b.
