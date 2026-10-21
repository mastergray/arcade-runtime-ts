// realizes: docs/arcade-runtime-spec.md > §11 Developer harness and §11.1 Preload config

// Dependencies:
import { ArcadePlayer, DEFAULT_KEYBOARD_MAP, KeyboardSource } from "/src/index.js";   // Public package surface only

// Type dependencies:
import type { RomSetReport } from "/src/index.js";                // Public audit report rendered below

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: sanitized /preload.json response emitted by serve-harness
interface BrowserPreloadConfig {
    readonly family: string;
    readonly machine: string;
    readonly bios?: string;
    readonly roms: ReadonlyArray<string>;
    readonly samples?: ReadonlyArray<string>;
    readonly dipswitches?: Readonly<Record<string, string>>;
    readonly autostart?: boolean;
    readonly romUrls: ReadonlyArray<string>;
}

// INTERFACE :: current form values whose exact combination owns one prepared player
interface Selection {
    readonly family: string;
    readonly machine: string;
    readonly bios?: string;
}

/**
 *
 * Functions
 *
 */

// HELPER :: STRING -> element
// Resolves one required page element and fails early when the committed HTML drifts.
const element = <T extends Element>(selector: string): T => {
    const value = document.querySelector<T>(selector);
    if (value === null) throw new Error(`Harness element ${selector} is missing.`);
    return value;
};

/**
 *
 * Constants
 *
 */

const familySelect = element<HTMLSelectElement>("#family");
const machineInput = element<HTMLInputElement>("#machine");
const biosInput = element<HTMLInputElement>("#bios");
const startButton = element<HTMLButtonElement>("#start");
const preloadNote = element<HTMLParagraphElement>("#preload-note");
const statusLine = element<HTMLParagraphElement>("#status");
const auditPanel = element<HTMLPreElement>("#audit");
const logPanel = element<HTMLPreElement>("#log");
const container = element<HTMLElement>("#player-container");
const canvas = element<HTMLCanvasElement>("#canvas");

/**
 *
 * State
 *
 */

let preload: BrowserPreloadConfig | null = null;                  // Present only when the server was given --preload
let player: ArcadePlayer | null = null;                           // Prepared or running public composition root
let keyboard: KeyboardSource | null = null;                       // Per-session default keyboard binding
let preparedSelection: string | null = null;                      // Stable key for the current player config
let auditOk = false;                                               // Start gate from the most recent report
let startPromise: Promise<void> | null = null;                    // Coalesces button and autostart click handlers

/**
 *
 * Functions
 *
 */

// HELPER :: STRING, STRING -> VOID
// Updates both the visible status and a stable browser-test state.
const setStatus = (message: string, state: string): void => {
    statusLine.textContent = message;
    statusLine.dataset.state = state;
};

// HELPER :: STRING -> VOID
// Appends one bounded diagnostic line without using HTML interpretation.
const log = (message: string): void => {
    const lines = `${logPanel.textContent ?? ""}\n${message}`.trim().split("\n").slice(-80);
    logPanel.textContent = lines.join("\n");
    logPanel.scrollTop = logPanel.scrollHeight;
};

// HELPER :: romSetReport -> VOID
// Renders all actionable report groups as plain text and publishes its verdict as data-status.
const renderAudit = (report: RomSetReport): void => {
    const lines = [
        `Audit: ${report.status}`,
        "",
        "Archives:",
        ...report.archives.map((archive) => `  ${archive.present ? "ok" : "missing"}  ${archive.role}  ${archive.name}${archive.required ? " (required)" : ""}`),
        "",
        "Files:",
        ...(report.files.length === 0 ? ["  No file rows."] : report.files.map((file) => `  ${file.status}  ${file.archive}/${file.name}`)),
        ...(report.unexpected.length === 0 ? [] : ["", "Unexpected:", ...report.unexpected.map((file) => `  ${file.archive}/${file.name}`)]),
        ...(report.problems.length === 0 ? [] : ["", "Problems:", ...report.problems.map((problem) => `  ${problem.archive}: ${problem.reason}`)]),
    ];
    auditPanel.textContent = lines.join("\n");
    auditPanel.dataset.status = report.status;
};

// HELPER :: VOID -> selection
// Reads and normalizes current controls at the moment a player is prepared.
const selection = (): Selection => {
    const bios = biosInput.value.trim();
    return {
        family: familySelect.value,
        machine: machineInput.value.trim(),
        ...(bios === "" ? {} : { bios }),
    };
};

// HELPER :: selection -> STRING
// Separates fields with NUL, which the form cannot contain, for an unambiguous reuse key.
const selectionKey = (value: Selection): string => `${value.family}\0${value.machine}\0${value.bios ?? ""}`;

// HELPER :: VOID -> PROMISE(VOID)
// Releases the keyboard channel before destroying any old player.
const destroyPlayer = async (): Promise<void> => {
    keyboard?.destroy();
    keyboard = null;
    const previous = player;
    player = null;
    preparedSelection = null;
    auditOk = false;
    if (previous !== null) await previous.destroy();
};

// HELPER :: VOID -> PROMISE(BOOLEAN)
// Creates a player from the form and sanitized preload URLs, runs the public pre-start audit and renders it.
const preparePlayer = async (): Promise<boolean> => {
    if (preload === null) return false;
    const chosen = selection();
    if (chosen.family === "" || chosen.machine === "") {
        setStatus("Choose a family build and enter a machine.", "invalid-selection");
        return false;
    }
    const key = selectionKey(chosen);
    if (player !== null && preparedSelection === key) return auditOk;

    await destroyPlayer();
    startButton.disabled = true;
    setStatus("Preparing player and loading ROM inputs…", "preparing");
    log("Preparing ArcadePlayer from the sanitized preload URLs.");
    const game = {
        machine: chosen.machine,
        machineHints: { players: 2 as const, buttons: 6 as const },
        roms: preload.romUrls,
        ...(chosen.bios === undefined ? {} : { bios: chosen.bios }),
        ...(preload.dipswitches === undefined ? {} : { dipswitches: preload.dipswitches }),
        display: { scaling: "fit" as const, imageRendering: "pixelated" as const },
    };
    const created = await ArcadePlayer.init({
        canvas,
        container,
        game,
        adapterConfig: { buildUrl: `/mame/${encodeURIComponent(chosen.family)}/` },
    });
    created.on("status", (status) => {
        log(`Player status: ${status}.`);
        if (status === "running") setStatus("Running. Keyboard controls are attached.", "running");
        else if (status === "paused") setStatus("Paused.", "paused");
    });
    created.on("exit", () => {
        keyboard?.destroy();
        keyboard = null;
        setStatus("The machine exited. Press Start to run it again.", "idle");
        startButton.disabled = false;
    });
    created.on("error", (error) => log(`Player error: ${error.message}`));
    player = created;
    preparedSelection = key;

    setStatus("Auditing supplied archives…", "auditing");
    const report = await created.audit();
    renderAudit(report);
    auditOk = report.status === "ok";
    startButton.disabled = !auditOk;
    if (auditOk) setStatus("Audit passed. Press Start to run the machine.", "ready");
    else setStatus("Audit did not pass. Review the report before starting.", "audit-failed");
    log(`Audit completed with status ${report.status}.`);
    return auditOk;
};

// HELPER :: VOID -> PROMISE(VOID)
// Audits current choices if needed, starts the real build, then binds the default keyboard map to its input.
const startSelected = async (): Promise<void> => {
    if (startPromise !== null) return startPromise;
    startPromise = (async () => {
        try {
            if (!(await preparePlayer()) || player === null) return;
            startButton.disabled = true;
            setStatus("Starting the machine…", "starting");
            await player.start();
            try {
                await player.audio.unlock();
                log("Audio context unlocked from the start gesture.");
            } catch (error) {
                log(`Audio unlock needs another gesture: ${error instanceof Error ? error.message : String(error)}`);
            }
            keyboard?.destroy();
            keyboard = KeyboardSource.init({ input: player.input, map: DEFAULT_KEYBOARD_MAP });
            keyboard.attach();
            startButton.disabled = true;
            setStatus("Running. Keyboard controls are attached.", "running");
        } catch (error) {
            startButton.disabled = !auditOk;
            setStatus(error instanceof Error ? error.message : "The machine could not start.", "error");
            log(`Start failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            startPromise = null;
        }
    })();
    return startPromise;
};

// HELPER :: VOID -> PROMISE([STRING])
// Fetches the server-generated list of direct build-root children.
const loadBuilds = async (): Promise<string[]> => {
    const response = await fetch("/builds.json");
    if (!response.ok) throw new Error("The family build list could not be loaded.");
    const value: unknown = await response.json();
    if (!Array.isArray(value) || !value.every((name) => typeof name === "string")) throw new Error("The family build list is invalid.");
    return value;
};

// HELPER :: VOID -> PROMISE(browserPreloadConfig?)
// Treats a 404 as normal no-preload mode; every other failed response is an error.
const loadPreload = async (): Promise<BrowserPreloadConfig | null> => {
    const response = await fetch("/preload.json");
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("The preload config could not be loaded.");
    return await response.json() as BrowserPreloadConfig;
};

// HELPER :: [STRING], STRING? -> VOID
// Populates the family selector strictly from discovered build directories.
const renderBuilds = (builds: ReadonlyArray<string>, selected?: string): void => {
    familySelect.replaceChildren();
    for (const family of builds) {
        const option = document.createElement("option");
        option.value = family;
        option.textContent = family;
        familySelect.append(option);
    }
    if (selected !== undefined && builds.includes(selected)) familySelect.value = selected;
};

// HELPER :: VOID -> PROMISE(VOID)
// Loads server state, fills controls and performs the preload audit before enabling start.
const initialize = async (): Promise<void> => {
    try {
        const [builds, configured] = await Promise.all([loadBuilds(), loadPreload()]);
        preload = configured;
        renderBuilds(builds, configured?.family);
        if (configured === null) {
            preloadNote.textContent = "No preload config is active. The file picker arrives with W13b.";
            setStatus(builds.length === 0 ? "No family builds were found under the build root." : "Choose a build; local file selection arrives with W13b.", "no-preload");
            log("Started without a preload config.");
            return;
        }
        machineInput.value = configured.machine;
        biosInput.value = configured.bios ?? "";
        preloadNote.textContent = "Private preload inputs are active through the server allowlist.";
        if (!builds.includes(configured.family)) throw new Error("The configured family build is unavailable under the build root.");
        const ok = await preparePlayer();
        if (ok && configured.autostart === true) {
            setStatus("Audit passed. Click anywhere once to start the machine.", "ready");
            document.addEventListener("click", () => { void startSelected(); }, { capture: true, once: true });
        }
    } catch (error) {
        startButton.disabled = true;
        setStatus(error instanceof Error ? error.message : "Harness initialization failed.", "error");
        log(`Initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
};

startButton.addEventListener("click", () => { void startSelected(); });
familySelect.addEventListener("change", () => { preparedSelection = null; startButton.disabled = preload === null; });
machineInput.addEventListener("input", () => { preparedSelection = null; startButton.disabled = preload === null; });
biosInput.addEventListener("input", () => { preparedSelection = null; startButton.disabled = preload === null; });
window.addEventListener("pagehide", () => {
    keyboard?.destroy();
    keyboard = null;
    void player?.destroy();
});

await initialize();
