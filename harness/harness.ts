// realizes: docs/arcade-runtime-spec.md > §11 Developer harness, §11.1 Preload config and §10.6 ArcadeCabinet

// Dependencies:
import {
    ArcadeCabinet,                                                // Complete player, inputs, persistence and local ROM composition
    ArcadeRomStore,                                               // Browser-local user-confirmed archive storage
    ArcadeRuntimeError,                                           // Typed overlay incompatibility detection
    ArcadeStorage,                                                // Per-family/machine save-overlay persistence
} from "/src/index.js";                                           // Public package surface only

// Type dependencies:
import type {
    ArcadeAdapter,                                                // Browser-test injection through the same public cabinet boundary
    RomSetReport,                                                 // Public audit report rendered below
    RomStoreEntry,                                                // Byte-free local store listing
} from "/src/index.js";                                           // Public package surface only

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

// INTERFACE :: current form values whose exact combination owns one prepared cabinet
interface Selection {
    readonly family: string;
    readonly machine: string;
    readonly bios?: string;
}

// TYPE :: "preload" | "store"
// The two user-controlled ROM supply paths; only the preload path can contain URLs.
type RomSourceMode = "preload" | "store";

// INTERFACE :: optional public adapter supplied by a browser acceptance case
// Production usage leaves this absent and resolves the selected family build normally.
interface HarnessAdapterBoundary {
    readonly __arcadeHarnessAdapter?: ArcadeAdapter;
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
const autosaveInput = element<HTMLInputElement>("#autosave");
const startButton = element<HTMLButtonElement>("#start");
const preloadNote = element<HTMLParagraphElement>("#preload-note");
const statusLine = element<HTMLParagraphElement>("#status");
const auditPanel = element<HTMLPreElement>("#audit");
const logPanel = element<HTMLPreElement>("#log");
const container = element<HTMLElement>("#player-container");
const canvas = element<HTMLCanvasElement>("#canvas");
const picker = element<HTMLInputElement>("#rom-picker");
const dropZone = element<HTMLElement>("#drop-zone");
const pendingList = element<HTMLUListElement>("#pending-roms");
const confirmButton = element<HTMLButtonElement>("#confirm-roms");
const auditButton = element<HTMLButtonElement>("#audit-roms");
const storeList = element<HTMLUListElement>("#rom-store");
const clearStoreButton = element<HTMLButtonElement>("#clear-store");
const fullscreenButton = element<HTMLButtonElement>("#fullscreen");
const soundButton = element<HTMLButtonElement>("#sound");
const softResetButton = element<HTMLButtonElement>("#soft-reset");
const hardResetButton = element<HTMLButtonElement>("#hard-reset");
const saveStateButton = element<HTMLButtonElement>("#save-state");
const loadStateButton = element<HTMLButtonElement>("#load-state");
const persistButton = element<HTMLButtonElement>("#persist");
const clearSavesButton = element<HTMLButtonElement>("#clear-saves");
const clearSavesRetryButton = element<HTMLButtonElement>("#clear-saves-retry");
const keyboardEnabledInput = element<HTMLInputElement>("#keyboard-enabled");
const gamepadsEnabledInput = element<HTMLInputElement>("#gamepads-enabled");
const gamepadsLine = element<HTMLParagraphElement>("#gamepads");
const sessionButtons = [
    fullscreenButton,
    soundButton,
    softResetButton,
    hardResetButton,
    saveStateButton,
    loadStateButton,
    persistButton,
    clearSavesButton,
] as const;

/**
 *
 * State
 *
 */

let preload: BrowserPreloadConfig | null = null;                  // Present only when the server was given --preload
let sourceMode: RomSourceMode = "store";                          // Preload initially wins when present; confirmed picks switch to store
let romStore: ArcadeRomStore | null = null;                       // One origin-local archive store for the page
let storeEntries: ReadonlyArray<RomStoreEntry> = [];              // Latest byte-free store snapshot
let pendingFiles: ReadonlyArray<File> = [];                       // Picked names and sizes awaiting explicit confirmation
let cabinet: ArcadeCabinet | null = null;                         // Prepared or running public composition root
let preparedSelection: string | null = null;                      // Stable key for the current cabinet config
let auditOk = false;                                               // Start gate from the most recent report
let startPromise: Promise<void> | null = null;                    // Coalesces button and autostart click handlers
let actionPromise: Promise<void> | null = null;                   // Serializes save/reset/menu actions
let cleanupPromise: Promise<void> = Promise.resolve();            // Orders replacement after the prior cabinet is terminal
let gamepadFrame: number | null = null;                           // Corner-menu connection display polling

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

// HELPER :: UNKNOWN -> STRING
// Produces a user-facing message without serializing configs, ROM bytes or local paths.
const errorMessage = (error: unknown, fallback: string): string => error instanceof Error ? error.message : fallback;

// HELPER :: NUMBER -> STRING
// Formats a selected or stored byte count without exposing any file content.
const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
};

// HELPER :: romSetReport -> VOID
// Renders every archive role and actionable report group as plain text.
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
// Reads and normalizes current controls at the moment a cabinet is prepared.
const selection = (): Selection => {
    const bios = biosInput.value.trim();
    return {
        family: familySelect.value,
        machine: machineInput.value.trim(),
        ...(bios === "" ? {} : { bios }),
    };
};

// HELPER :: VOID -> BOOLEAN
// True when the current source mode has at least one user-authorized archive.
const hasRomSource = (): boolean => sourceMode === "preload"
    ? preload !== null && preload.romUrls.length > 0
    : storeEntries.length > 0;

// HELPER :: selection -> STRING
// Includes byte-free store fingerprints so replacing an archive invalidates a prepared cabinet.
const selectionKey = (value: Selection): string => {
    const source = sourceMode === "preload"
        ? preload?.roms.join("\0") ?? ""
        : storeEntries.map((entry) => `${entry.name}\0${entry.sha256}`).join("\0");
    return `${value.family}\0${value.machine}\0${value.bios ?? ""}\0${sourceMode}\0${source}\0${autosaveInput.checked}`;
};

// HELPER :: VOID -> VOID
// Applies page availability from the latest cabinet, audit and source state.
const updateControls = (): void => {
    const chosen = selection();
    const running = cabinet?.isStarted === true;
    const canAudit = chosen.family !== "" && chosen.machine !== "" && hasRomSource();
    startButton.disabled = running || !auditOk;
    auditButton.disabled = running || !canAudit;
    for (const button of sessionButtons) button.disabled = !running;
    familySelect.disabled = running;
    machineInput.disabled = running;
    biosInput.disabled = running;
    autosaveInput.disabled = running;
    keyboardEnabledInput.disabled = !running;
    gamepadsEnabledInput.disabled = !running;
};

// HELPER :: VOID -> VOID
// Shows picked basenames and sizes while keeping bytes only in the File objects awaiting confirmation.
const renderPending = (): void => {
    pendingList.replaceChildren();
    if (pendingFiles.length === 0) {
        const empty = document.createElement("li");
        empty.textContent = "No archives picked.";
        pendingList.append(empty);
    } else {
        for (const file of pendingFiles) {
            const item = document.createElement("li");
            const name = document.createElement("span");
            const size = document.createElement("span");
            name.textContent = file.name;
            size.textContent = formatSize(file.size);
            item.append(name, size);
            pendingList.append(item);
        }
    }
    confirmButton.disabled = pendingFiles.length === 0;
};

// HELPER :: VOID -> VOID
// Builds a byte-free store listing with one explicit remove action per archive.
const renderStore = (): void => {
    storeList.replaceChildren();
    if (storeEntries.length === 0) {
        const empty = document.createElement("li");
        empty.textContent = "The browser-local store is empty.";
        storeList.append(empty);
    } else {
        for (const entry of storeEntries) {
            const item = document.createElement("li");
            const description = document.createElement("span");
            const remove = document.createElement("button");
            description.textContent = `${entry.name} — ${formatSize(entry.size)}`;
            remove.type = "button";
            remove.className = "store-remove";
            remove.textContent = "Remove";
            remove.addEventListener("click", () => { void removeStored(entry.name); });
            item.append(description, remove);
            storeList.append(item);
        }
    }
    clearStoreButton.disabled = storeEntries.length === 0;
    updateControls();
};

// HELPER :: VOID -> PROMISE(VOID)
// Refreshes only byte-free metadata from IndexedDB.
const refreshStore = async (): Promise<void> => {
    if (romStore === null) return;
    storeEntries = await romStore.list();
    renderStore();
};

// HELPER :: VOID -> VOID
// Retires an existing cabinet in order and immediately makes it unavailable to later handlers.
const retireCabinet = (): void => {
    const previous = cabinet;
    cabinet = null;
    preparedSelection = null;
    auditOk = false;
    if (previous !== null) {
        cleanupPromise = cleanupPromise.then(() => previous.destroy()).catch((error: unknown) => {
            log(`Cabinet cleanup failed: ${errorMessage(error, "unknown cleanup failure")}`);
        });
    }
    updateControls();
};

// HELPER :: VOID -> VOID
// Marks the current audit stale after a form or store change without hiding its prior diagnostic text.
const invalidateSelection = (): void => {
    if (cabinet?.isStarted !== true) retireCabinet();
    else {
        preparedSelection = null;
        auditOk = false;
    }
    auditPanel.dataset.status = "stale";
    clearSavesRetryButton.hidden = true;
    updateControls();
};

// HELPER :: STRING -> PROMISE(VOID)
// Removes one named local archive without changing save-overlay storage.
const removeStored = async (name: string): Promise<void> => {
    if (romStore === null) return;
    try {
        await romStore.remove(name);
        sourceMode = "store";
        await refreshStore();
        invalidateSelection();
        setStatus(`Removed ${name} from the browser-local ROM store.`, "store-updated");
    } catch (error) {
        setStatus(errorMessage(error, "The archive could not be removed."), "error");
    }
};

// HELPER :: [FILE] -> VOID
// Accepts only unique zip basenames and waits for a separate confirmation before reading bytes.
const chooseFiles = (files: ReadonlyArray<File>): void => {
    const seen = new Set<string>();
    if (files.length === 0 || files.some((file) => !/\.zip$/i.test(file.name) || seen.has(file.name.toLowerCase()) || !seen.add(file.name.toLowerCase()))) {
        pendingFiles = [];
        renderPending();
        setStatus("Choose one or more zip files with unique basenames.", "invalid-selection");
        return;
    }
    pendingFiles = [...files];
    renderPending();
    setStatus("Review the picked basenames and sizes, then confirm to store them locally.", "pending-confirmation");
};

// HELPER :: VOID -> PROMISE(BOOLEAN)
// Creates ArcadeCabinet from preload URLs or bare store basenames and renders its pre-start audit.
const prepareCabinet = async (): Promise<boolean> => {
    const store = romStore;
    const chosen = selection();
    if (store === null || chosen.family === "" || chosen.machine === "" || !hasRomSource()) {
        setStatus("Choose a family, enter a machine and supply ROM zip files.", "invalid-selection");
        updateControls();
        return false;
    }
    const key = selectionKey(chosen);
    if (cabinet !== null && preparedSelection === key) return auditOk;

    retireCabinet();
    await cleanupPromise;
    startButton.disabled = true;
    auditButton.disabled = true;
    setStatus("Preparing cabinet and loading ROM inputs…", "preparing");
    log(`Preparing ArcadeCabinet from the ${sourceMode === "preload" ? "sanitized preload" : "browser-local ROM store"}.`);

    const storage = ArcadeStorage.init({ key: `${chosen.family}/${chosen.machine}` });
    const roms = sourceMode === "preload" && preload !== null
        ? preload.romUrls
        : storeEntries.map((entry) => entry.name);
    const game = {
        machine: chosen.machine,
        machineHints: { players: 2 as const, buttons: 6 as const },
        roms,
        ...(chosen.bios === undefined ? {} : { bios: chosen.bios }),
        ...(sourceMode === "preload" && preload?.dipswitches !== undefined ? { dipswitches: preload.dipswitches } : {}),
        display: { scaling: "fit" as const, imageRendering: "pixelated" as const },
    };
    const common = {
        canvas,
        container,
        game,
        controls: {
            keyboard: { enabled: keyboardEnabledInput.checked },
            gamepads: { enabled: gamepadsEnabledInput.checked },
        },
        storage,
        romStore: store,
        autosave: autosaveInput.checked,
    };
    const injected = (globalThis as unknown as HarnessAdapterBoundary).__arcadeHarnessAdapter;
    const created = injected === undefined
        ? await ArcadeCabinet.init({ ...common, adapterConfig: { buildUrl: `/mame/${encodeURIComponent(chosen.family)}/` } })
        : await ArcadeCabinet.init({ ...common, adapter: injected });
    created.player.on("status", (status) => {
        if (cabinet !== created) return;
        log(`Player status: ${status}.`);
        if (status === "running") setStatus("Running. Keyboard and gamepad controls are attached.", "running");
        else if (status === "paused") setStatus("Paused.", "paused");
        updateControls();
    });
    created.player.on("exit", () => {
        if (cabinet !== created) return;
        setStatus("The machine exited. Press Start to run it again.", "idle");
        updateControls();
    });
    created.player.on("error", (error) => log(`Player error: ${error.message}`));
    cabinet = created;
    preparedSelection = key;

    setStatus("Auditing supplied archives…", "auditing");
    const report = await created.audit();
    renderAudit(report);
    auditOk = report.status === "ok";
    if (auditOk) setStatus("Audit passed. Press Start to run the machine.", "ready");
    else setStatus("Audit did not pass. Review each archive role before starting.", "audit-failed");
    log(`Audit completed with status ${report.status}.`);
    updateControls();
    return auditOk;
};

// HELPER :: VOID -> PROMISE(VOID)
// Audits the current source explicitly and contains all page-level error reporting.
const auditSelected = async (): Promise<void> => {
    try {
        await prepareCabinet();
    } catch (error) {
        retireCabinet();
        setStatus(errorMessage(error, "The ROM source could not be audited."), "error");
        log(`Audit failed: ${errorMessage(error, "unknown audit failure")}`);
    }
};

// HELPER :: VOID -> PROMISE(VOID)
// Audits current choices if needed, starts the cabinet and attempts audio unlock from the same gesture.
const startSelected = async (): Promise<void> => {
    if (startPromise !== null) return startPromise;
    startPromise = (async () => {
        try {
            if (!(await prepareCabinet()) || cabinet === null) return;
            const selectedCabinet = cabinet;
            startButton.disabled = true;
            setStatus("Starting the machine…", "starting");
            await selectedCabinet.start();
            try {
                await selectedCabinet.player.audio.unlock();
                log("Audio context unlocked from the start gesture.");
            } catch (error) {
                log(`Audio unlock needs another gesture: ${errorMessage(error, "unknown audio failure")}`);
            }
            soundButton.textContent = selectedCabinet.player.audio.isMuted ? "Unmute sound" : "Mute sound";
            setStatus("Running. Keyboard and gamepad controls are attached.", "running");
        } catch (error) {
            if (ArcadeRuntimeError.is(error) && error.code === ArcadeRuntimeError.CODE.OVERLAY_INCOMPATIBLE) {
                clearSavesRetryButton.hidden = false;
                setStatus("Stored saves are incompatible. Clear saves and retry only if you choose to.", "overlay-incompatible");
                log("Start stopped because the stored overlay is incompatible; no saves were cleared.");
            } else {
                setStatus(errorMessage(error, "The machine could not start."), "error");
                log(`Start failed: ${errorMessage(error, "unknown start failure")}`);
            }
        } finally {
            startPromise = null;
            updateControls();
        }
    })();
    return startPromise;
};

// HELPER :: VOID -> PROMISE(VOID)
// Copies explicitly confirmed picks into IndexedDB, switches to basename resolution and audits them.
const confirmPicked = async (): Promise<void> => {
    if (romStore === null || pendingFiles.length === 0) return;
    confirmButton.disabled = true;
    try {
        setStatus("Copying confirmed archives into the browser-local ROM store…", "storing");
        for (const file of pendingFiles) {
            await romStore.put({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
        }
        pendingFiles = [];
        picker.value = "";
        renderPending();
        sourceMode = "store";
        await refreshStore();
        invalidateSelection();
        setStatus("Confirmed archives are stored only in this browser. Auditing them now…", "stored");
        await auditSelected();
    } catch (error) {
        setStatus(errorMessage(error, "The picked archives could not be stored."), "error");
        log(`Store update failed: ${errorMessage(error, "unknown store failure")}`);
    } finally {
        confirmButton.disabled = pendingFiles.length === 0;
    }
};

// HELPER :: VOID -> PROMISE(VOID)
// Clears the ROM store only; save overlays remain untouched.
const clearStore = async (): Promise<void> => {
    if (romStore === null) return;
    try {
        await romStore.clear();
        sourceMode = "store";
        await refreshStore();
        invalidateSelection();
        setStatus("The browser-local ROM store is empty. Saved games were not changed.", "store-cleared");
    } catch (error) {
        setStatus(errorMessage(error, "The ROM store could not be cleared."), "error");
    }
};

// HELPER :: STRING, STRING, (arcadeCabinet -> PROMISE(STRING | VOID) | STRING | VOID) -> PROMISE(VOID)
// Serializes a corner-menu action and gives each result a stable status state.
const runCabinetAction = async (
    successState: string,
    fallback: string,
    action: (selected: ArcadeCabinet) => Promise<string | void> | string | void,
): Promise<void> => {
    if (actionPromise !== null || cabinet?.isStarted !== true) return;
    const selected = cabinet;
    actionPromise = (async () => {
        try {
            const message = await action(selected);
            if (message !== undefined) setStatus(message, successState);
        } catch (error) {
            setStatus(errorMessage(error, fallback), "error");
            log(`${fallback}: ${errorMessage(error, "unknown cabinet action failure")}`);
        } finally {
            actionPromise = null;
            updateControls();
        }
    })();
    return actionPromise;
};

// HELPER :: VOID -> VOID
// Refreshes the page-owned gamepad assignment display from GamepadSource.players.
const updateGamepads = (): void => {
    const players = cabinet?.gamepads?.players ?? [];
    gamepadsLine.textContent = players.length === 0
        ? "Connected gamepads: none"
        : `Connected gamepads: ${players.map(({ player, id }) => `P${player} ${id}`).join(", ")}`;
    gamepadFrame = requestAnimationFrame(updateGamepads);
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
// Loads browser-local and server state, fills controls and performs the preload audit before enabling start.
const initialize = async (): Promise<void> => {
    try {
        const [builds, configured, store] = await Promise.all([loadBuilds(), loadPreload(), ArcadeRomStore.init()]);
        preload = configured;
        romStore = store;
        sourceMode = configured === null ? "store" : "preload";
        renderBuilds(builds, configured?.family);
        await refreshStore();
        updateGamepads();
        if (configured === null) {
            preloadNote.textContent = "No preload config is active. Pick lawful zip files; confirmed archives remain in this browser only.";
            setStatus(builds.length === 0 ? "No family builds were found under the build root." : "Choose a build and machine, then pick zip files.", "no-preload");
            log("Started without a preload config.");
            updateControls();
            return;
        }
        machineInput.value = configured.machine;
        biosInput.value = configured.bios ?? "";
        preloadNote.textContent = "Private preload inputs are active through the server allowlist.";
        if (!builds.includes(configured.family)) throw new Error("The configured family build is unavailable under the build root.");
        const ok = await prepareCabinet();
        if (ok && configured.autostart === true) {
            setStatus("Audit passed. Click anywhere once to start the machine.", "ready");
            document.addEventListener("click", () => { void startSelected(); }, { capture: true, once: true });
        }
    } catch (error) {
        startButton.disabled = true;
        setStatus(errorMessage(error, "Harness initialization failed."), "error");
        log(`Initialization failed: ${errorMessage(error, "unknown initialization failure")}`);
    }
};

picker.addEventListener("change", () => chooseFiles(Array.from(picker.files ?? [])));
dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.dataset.active = "true";
});
dropZone.addEventListener("dragleave", () => { dropZone.dataset.active = "false"; });
dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.dataset.active = "false";
    chooseFiles(Array.from(event.dataTransfer?.files ?? []));
});
confirmButton.addEventListener("click", () => { void confirmPicked(); });
auditButton.addEventListener("click", () => { void auditSelected(); });
clearStoreButton.addEventListener("click", () => { void clearStore(); });
startButton.addEventListener("click", () => { void startSelected(); });

const formChanged = (): void => {
    invalidateSelection();
    setStatus("Selection changed. Run the audit before starting.", "selection-changed");
};
familySelect.addEventListener("change", formChanged);
machineInput.addEventListener("input", formChanged);
biosInput.addEventListener("input", formChanged);
autosaveInput.addEventListener("change", formChanged);

fullscreenButton.addEventListener("click", () => { void runCabinetAction("fullscreen", "Fullscreen could not be changed", async (selected) => {
    if (document.fullscreenElement === null) {
        await selected.fullscreen();
        return "Fullscreen entered.";
    }
    await selected.exitFullscreen();
    return "Fullscreen exited.";
}); });
soundButton.addEventListener("click", () => { void runCabinetAction("sound-updated", "Sound could not be changed", async (selected) => {
    if (selected.player.audio.isMuted) {
        selected.player.audio.unmute();
        await selected.player.audio.unlock();
        soundButton.textContent = "Mute sound";
        return "Sound is unmuted.";
    }
    selected.player.audio.mute();
    soundButton.textContent = "Unmute sound";
    return "Sound is muted.";
}); });
softResetButton.addEventListener("click", () => { void runCabinetAction("soft-reset", "Soft reset failed", (selected) => {
    selected.player.reset("soft");
    return "Soft reset requested.";
}); });
hardResetButton.addEventListener("click", () => { void runCabinetAction("resetting", "Hard reset failed", (selected) => {
    selected.player.reset("hard");
    return "Hard reset requested.";
}); });
saveStateButton.addEventListener("click", () => { void runCabinetAction("state-saved", "Quick state could not be saved", async (selected) => {
    await selected.player.saveState("quick");
    return "Quick state saved. Use Persist now to keep it across reloads.";
}); });
loadStateButton.addEventListener("click", () => { void runCabinetAction("state-loaded", "Quick state could not be loaded", async (selected) => {
    await selected.player.loadState("quick");
    return "Quick state loaded.";
}); });
persistButton.addEventListener("click", () => { void runCabinetAction("persisted", "Changes could not be persisted", async (selected) => {
    const saved = await selected.save();
    return saved ? "Current changes were persisted locally." : "There were no new changes to persist.";
}); });
clearSavesButton.addEventListener("click", () => { void runCabinetAction("saves-cleared", "Saved changes could not be cleared", async (selected) => {
    await selected.clearSaves();
    return "Saved changes were cleared. The ROM store was not changed.";
}); });
clearSavesRetryButton.addEventListener("click", () => {
    void (async () => {
        const selected = cabinet;
        if (selected === null) return;
        try {
            await selected.clearSaves();
            retireCabinet();
            await cleanupPromise;
            clearSavesRetryButton.hidden = true;
            setStatus("Saved changes were cleared by request. Retrying…", "retrying");
            await startSelected();
        } catch (error) {
            setStatus(errorMessage(error, "Saved changes could not be cleared."), "error");
        }
    })();
});
keyboardEnabledInput.addEventListener("change", () => {
    if (cabinet?.isStarted !== true) return;
    cabinet.keyboardEnabled = keyboardEnabledInput.checked;
    setStatus(`Keyboard controls ${keyboardEnabledInput.checked ? "enabled" : "disabled"}.`, "controls-updated");
});
gamepadsEnabledInput.addEventListener("change", () => {
    if (cabinet?.isStarted !== true) return;
    cabinet.gamepadsEnabled = gamepadsEnabledInput.checked;
    setStatus(`Gamepad controls ${gamepadsEnabledInput.checked ? "enabled" : "disabled"}.`, "controls-updated");
});
window.addEventListener("pagehide", () => {
    if (gamepadFrame !== null) cancelAnimationFrame(gamepadFrame);
    gamepadFrame = null;
    retireCabinet();
});

renderPending();
updateControls();
await initialize();
