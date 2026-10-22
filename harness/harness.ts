// realizes: docs/arcade-runtime-spec.md > §11 Developer harness, §11.1 Preload config, §10.5 RomSetAudit and §10.6 ArcadeCabinet

// Dependencies:
import {
    ArcadeCabinet,                                                // Complete player, controls, persistence and local-ROM composition
    ArcadeRomStore,                                               // Browser-local user-confirmed archive storage
    ArcadeRuntimeError,                                           // Typed overlay incompatibility detection
    ArcadeStorage,                                                // Per-family/machine save-overlay persistence
    DEFAULT_KEYBOARD_MAP,                                         // Listed in the cabinet menu so a player can see the bindings
    RomSetAudit,                                                  // Fast per-card check before a cabinet is started
    isBuildInfo,                                                  // Validates each served family index
    isRomSetMetadata,                                             // Validates fetched per-game metadata
} from "/src/index.js";                                         // Public package surface only

// Type dependencies:
import type {
    ArcadeAdapter,                                                // Browser-test injection through the public cabinet boundary
    BuildInfo,                                                    // Validated family-build index document
    RomFile,                                                      // Bytes passed to the card-level file checker
    RomSetMetadata,                                               // Card title, companion files, BIOS and DIP choices
    RomSetReport,                                                 // File-check result rendered in plain language
    RomStoreEntry,                                                // Byte-free local-store listing
} from "/src/index.js";                                         // Public package surface only

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

// INTERFACE :: one machine discovered from one validated family build
interface IndexedMachine {
    readonly family: string;
    readonly machine: string;
    readonly build: BuildInfo;
    readonly buildUrl: string;
    readonly metadataUrl: string;
}

// TYPE :: idle | loading | complete | failed
// Card-local file-check progress, independent of the running cabinet.
type CheckState = "idle" | "loading" | "complete" | "failed";

// INTERFACE :: one rendered game and its retained page choices
interface GameCard {
    readonly key: string;
    readonly indexed: IndexedMachine;
    readonly metadata: RomSetMetadata | null;
    readonly metadataError?: string;
    readonly preloadSelected: boolean;
    readonly warnings: ReadonlyArray<string>;
    bios: string;
    dipValues: Record<string, string>;
    report: RomSetReport | null;
    checkState: CheckState;
    checkError?: string;
    settingsOpen: boolean;                                         // Whether the card's game-settings section is expanded
}

// INTERFACE :: BIOS and non-default DIP values passed to the most recently started cabinet
// Exposed without ROM data so browser acceptance can verify the page-to-session boundary.
interface LastStartConfig {
    readonly bios?: string;
    readonly dipswitches: Readonly<Record<string, string>>;
}

// INTERFACE :: optional public adapter supplied by a browser acceptance case
// Production usage leaves this absent and resolves the card's family build normally.
interface HarnessAdapterBoundary {
    readonly __arcadeHarnessAdapter?: ArcadeAdapter;
    __arcadeHarnessLastStartConfig?: LastStartConfig;
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

const picker = element<HTMLInputElement>("#rom-picker");
const dropZone = element<HTMLElement>("#drop-zone");
const storeAllButton = element<HTMLButtonElement>("#store-all");
const librarySummary = element<HTMLParagraphElement>("#library-summary");
const buildWarnings = element<HTMLUListElement>("#build-warnings");
const preloadNote = element<HTMLParagraphElement>("#preload-note");
const statusLine = element<HTMLParagraphElement>("#status");
const library = element<HTMLDivElement>("#library");
const storedFiles = element<HTMLUListElement>("#stored-files");
const clearFilesButton = element<HTMLButtonElement>("#clear-files");
const auditPanel = element<HTMLPreElement>("#audit");
const logPanel = element<HTMLPreElement>("#log");
const container = element<HTMLElement>("#player-container");
const canvas = element<HTMLCanvasElement>("#canvas");
const fullscreenButton = element<HTMLButtonElement>("#fullscreen");
const soundButton = element<HTMLButtonElement>("#sound");
const softResetButton = element<HTMLButtonElement>("#soft-reset");
const hardResetButton = element<HTMLButtonElement>("#hard-reset");
const saveStateButton = element<HTMLButtonElement>("#save-state");
const loadStateButton = element<HTMLButtonElement>("#load-state");
const persistButton = element<HTMLButtonElement>("#persist");
const clearSavesButton = element<HTMLButtonElement>("#clear-saves");
const clearSavesRetryButton = element<HTMLButtonElement>("#clear-saves-retry");
const cornerMenu = element<HTMLDetailsElement>("#corner-menu");
const autosaveInput = element<HTMLInputElement>("#autosave");
const keyboardEnabledInput = element<HTMLInputElement>("#keyboard-enabled");
const gamepadsEnabledInput = element<HTMLInputElement>("#gamepads-enabled");
const gamepadsLine = element<HTMLParagraphElement>("#gamepads");
const keyboardBindings = element<HTMLElement>("#keyboard-bindings");

// HELPER :: STRING -> STRING
// Turns a KeyboardEvent.code into the label printed on the key.
const keyLabel = (code: string): string => {
    if (code.startsWith("Key")) return code.slice(3);
    if (code.startsWith("Digit")) return code.slice(5);
    if (code.startsWith("Arrow")) return `${code.slice(5)} arrow`;
    return code.replace(/Left$/, " (left)").replace(/([a-z])([A-Z])/g, "$1 $2");
};

// HELPER :: VOID -> VOID
// Renders the default keyboard map as one line per player plus the cabinet keys, from the library's own export.
const renderKeyboardBindings = (): void => {
    const lines = new Map<string, string[]>();
    for (const [code, control] of Object.entries(DEFAULT_KEYBOARD_MAP)) {
        const group = "player" in control ? `Player ${control.player}` : "Cabinet";
        const what = control.kind === "direction" ? control.direction
            : control.kind === "button" ? `button ${control.button}`
            : control.kind;
        lines.set(group, [...(lines.get(group) ?? []), `${what}: ${keyLabel(code)}`]);
    }
    keyboardBindings.replaceChildren(...[...lines.entries()].map(([group, entries]) => {
        const row = document.createElement("p");
        const strong = document.createElement("strong");
        strong.textContent = `${group} — `;
        row.append(strong, entries.join(", "));
        return row;
    }));
};
renderKeyboardBindings();
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

const machineIndex = new Map<string, IndexedMachine>();          // Case-folded short name to served family build
const cards = new Map<string, GameCard>();                        // Discovered games retained for this page visit
const pendingFiles = new Map<string, File>();                     // Chosen archives awaiting one explicit store action
const storedEntries = new Map<string, RomStoreEntry>();           // Latest byte-free browser-local snapshot
const preloadArchives = new Map<string, { readonly name: string; readonly url: string }>();   // Sanitized private URLs
let preload: BrowserPreloadConfig | null = null;                  // Present only when the server was given --preload
let preloadCardKey: string | null = null;                         // Explicit preload machine; never suppressed as a companion
let romStore: ArcadeRomStore | null = null;                       // One origin-local archive store for the page
let cabinet: ArcadeCabinet | null = null;                         // The sole prepared or running cabinet
let activeCardKey: string | null = null;                          // Card owning the current cabinet
let preparedChoice = "";                                         // BIOS/DIP signature captured for the running cabinet
let startPromise: Promise<void> | null = null;                    // Coalesces Start and preload gesture handlers
let libraryPromise: Promise<void> | null = null;                  // Serializes store/remove operations
let menuPromise: Promise<void> | null = null;                     // Serializes cabinet-menu operations
let gamepadFrame: number | null = null;                           // Corner-menu connection display polling
let discoveryRequest = 0;                                        // Rejects superseded asynchronous metadata discovery
let buildsLoaded = 0;                                            // Successfully indexed family count

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

// HELPER :: STRING -> STRING
// Applies the comparison folding used by the ROM store and drops one zip suffix.
const archiveKey = (name: string): string => name.toLowerCase();
const machineNameFromArchive = (name: string): string => name.replace(/\.zip$/i, "").toLowerCase();
const cardKey = (family: string, machine: string): string => `${family.toLowerCase()}\0${machine.toLowerCase()}`;

// HELPER :: NUMBER -> STRING
// Formats a stored byte count without exposing file content.
const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
};

// HELPER :: VOID -> MAP(STRING, STRING)
// Returns one display basename for every archive currently known to the page.
const archiveNames = (): Map<string, string> => {
    const names = new Map<string, string>();
    for (const entry of storedEntries.values()) names.set(archiveKey(entry.name), entry.name);
    for (const entry of preloadArchives.values()) names.set(archiveKey(entry.name), entry.name);
    for (const file of pendingFiles.values()) names.set(archiveKey(file.name), file.name);
    return names;
};

// HELPER :: STRING -> BOOLEAN
// True when a chosen, preloaded or stored archive matches the basename.
const hasArchive = (name: string): boolean => {
    const key = archiveKey(name);
    return pendingFiles.has(key) || preloadArchives.has(key) || storedEntries.has(key);
};

// HELPER :: gameCard -> [STRING]
// Finds chosen files belonging to this card, including non-machine companion archives.
const pendingForCard = (card: GameCard): string[] => card.metadata === null ? [] : card.metadata.archives
    .map((archive) => archiveKey(archive.name))
    .filter((key) => pendingFiles.has(key));

// HELPER :: gameCard -> {[STRING]:STRING}
// Returns only non-default DIP choices, exactly as ArcadeStartConfig requires.
const selectedDips = (card: GameCard): Readonly<Record<string, string>> => {
    if (card.metadata === null) return {};
    const selected: Record<string, string> = {};
    for (const dipswitch of card.metadata.dipswitches ?? []) {
        const defaultSetting = dipswitch.values.find((setting) => setting.default)!;
        const chosen = card.dipValues[dipswitch.name] ?? defaultSetting.name;
        if (chosen !== defaultSetting.name) selected[dipswitch.name] = chosen;
    }
    return selected;
};

// HELPER :: gameCard -> STRING
// Stable BIOS/DIP page-state signature used to offer an explicit restart.
const choiceSignature = (card: GameCard): string => JSON.stringify({
    bios: card.bios,
    dipswitches: Object.entries(selectedDips(card)).sort(([left], [right]) => left.localeCompare(right)),
});

// HELPER :: gameCard -> BOOLEAN
// True when this card still has the exact choices used by its running cabinet.
const isRunningCard = (card: GameCard): boolean => activeCardKey === card.key && cabinet?.isStarted === true;

// HELPER :: VOID -> [gameCard]
// Suppresses a parent/BIOS/device machine card when its zip is serving another discovered game as a companion.
const visibleCards = (): GameCard[] => {
    const values = [...cards.values()];
    return values.filter((candidate) => {
        if (candidate.key === preloadCardKey) return true;
        const primary = archiveKey(`${candidate.indexed.machine}.zip`);
        return !values.some((owner) => owner.key !== candidate.key && owner.metadata?.archives.some((archive) => (
            archiveKey(archive.name) === primary && archive.role !== "game"
        )) === true);
    }).sort((left, right) => {
        const leftName = left.metadata?.description ?? left.indexed.machine;
        const rightName = right.metadata?.description ?? right.indexed.machine;
        return leftName.localeCompare(rightName);
    });
};

// HELPER :: romSetReport, gameCard -> VOID
// Renders the latest complete report in the closed-by-default diagnostic panel.
const renderDetailedCheck = (report: RomSetReport, card: GameCard): void => {
    const lines = [
        `${card.metadata?.description ?? card.indexed.machine}: ${report.status}`,
        "",
        ...report.archives.map((archive) => `${archive.present ? "present" : "missing"}  ${archive.role}  ${archive.name}`),
        ...(report.files.length === 0 ? [] : ["", ...report.files.map((file) => `${file.status}  ${file.archive}/${file.name}`)]),
        ...(report.problems.length === 0 ? [] : ["", ...report.problems.map((problem) => `${problem.archive}: ${problem.reason}`)]),
    ];
    auditPanel.textContent = lines.join("\n");
    auditPanel.dataset.status = report.status;
};

// HELPER :: gameCard, metadataArchive -> {message:STRING,state:STRING}
// Turns report vocabulary into a plain-language line for one required or optional zip.
const archiveLine = (card: GameCard, archive: RomSetMetadata["archives"][number]): { readonly message: string; readonly state: string } => {
    const key = archiveKey(archive.name);
    if (pendingFiles.has(key)) return { message: `${archive.name} is ready to store.`, state: "ok" };
    if (card.report === null || card.checkState !== "complete") {
        return hasArchive(archive.name)
            ? { message: `${archive.name} is available.`, state: "ok" }
            : { message: `Needs ${archive.name}.`, state: "missing" };
    }
    const problem = card.report.problems.find((entry) => archiveKey(entry.archive) === key);
    if (problem !== undefined) return { message: `Could not read ${archive.name}: ${problem.reason}`, state: "bad" };
    const row = card.report.archives.find((entry) => archiveKey(entry.name) === key);
    const files = card.report.files.filter((file) => archiveKey(file.archive) === key);
    const missing = files.find((file) => file.status === "missing");
    if (row?.present === false && missing !== undefined) return { message: `Needs ${archive.name}.`, state: "missing" };
    const wrong = files.find((file) => file.status === "wrong-crc" || file.status === "wrong-size");
    if (wrong !== undefined) return { message: `Wrong version of file ${wrong.name} in ${archive.name}.`, state: "bad" };
    if (missing !== undefined) return { message: `${archive.name} is missing file ${missing.name}.`, state: "missing" };
    if (row?.present === true) return { message: `${archive.name} is ready.`, state: "ok" };
    if (row?.required === false) return { message: `${archive.name} is optional and is not present.`, state: "ok" };
    return { message: `Needs ${archive.name}.`, state: "missing" };
};

// HELPER :: gameCard -> STRING
// Summarizes one card without requiring the user to understand audit status names.
const cardVerdict = (card: GameCard): string => {
    if (card.metadata === null) return card.metadataError ?? "The game details could not be loaded.";
    if (pendingForCard(card).length > 0) return "Store the files on this card to check them.";
    if (card.checkState === "loading") return "Checking these files…";
    if (card.checkState === "failed") return card.checkError ?? "These files could not be checked.";
    if (card.report === null) return "Add the files shown above, then store and check them.";
    if (card.report.status === "ok") return "Ready to play.";
    const report = card.report;
    const missingArchive = report.archives.find((archive) => !archive.present
        && (archive.required || report.files.some((file) => file.status === "missing" && archiveKey(file.archive) === archiveKey(archive.name))));
    if (missingArchive !== undefined) return `Needs ${missingArchive.name}.`;
    const wrong = card.report.files.find((file) => file.status === "wrong-crc" || file.status === "wrong-size");
    if (wrong !== undefined) return `Wrong version of file ${wrong.name}.`;
    const missing = card.report.files.find((file) => file.status === "missing");
    return missing === undefined ? "Some required files are missing." : `Missing file ${missing.name} from ${missing.archive}.`;
};

// HELPER :: STRING, STRING, VOID -> htmlButtonElement
// Creates a consistently typed card action.
const actionButton = (label: string, className: string, action: () => void): HTMLButtonElement => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", action);
    return button;
};

// HELPER :: gameCard -> htmlElement
// Builds BIOS and DIP controls inside exactly the game card whose metadata supplied them.
const renderSelectors = (card: GameCard): HTMLElement | null => {
    const metadata = card.metadata;
    if (metadata === null || (metadata.bios.length === 0 && (metadata.dipswitches?.length ?? 0) === 0)) return null;
    const needsRestart = isRunningCard(card) && preparedChoice !== choiceSignature(card);
    const panel = document.createElement("details");
    panel.className = "machine-selectors";
    panel.dataset.selectors = card.indexed.machine;
    panel.open = card.settingsOpen || needsRestart;
    panel.addEventListener("toggle", () => { card.settingsOpen = panel.open; });
    const summary = document.createElement("summary");
    summary.textContent = metadata.bios.length > 0 && (metadata.dipswitches?.length ?? 0) > 0 ? "Game settings and system version" : metadata.bios.length > 0 ? "System version" : "Game settings";
    panel.append(summary);
    const grid = document.createElement("div");
    grid.className = "selector-grid";

    if (metadata.bios.length > 0) {
        const label = document.createElement("label");
        label.append("System version");
        const select = document.createElement("select");
        select.className = "bios-select";
        select.setAttribute("aria-label", "BIOS option");
        const automatic = document.createElement("option");
        automatic.value = "";
        automatic.textContent = "Automatic";
        select.append(automatic);
        for (const bios of metadata.bios) {
            const option = document.createElement("option");
            option.value = bios;
            option.textContent = `${bios}${bios === metadata.defaultBios ? " (default)" : ""}`;
            select.append(option);
        }
        select.value = card.bios;
        select.addEventListener("change", () => {
            card.bios = select.value;
            card.report = null;
            card.checkState = "idle";
            renderLibrary();
            setStatus(isRunningCard(card) ? "This system choice needs a restart." : "Checking this system choice…", isRunningCard(card) ? "restart-required" : "checking");
            if (pendingForCard(card).length === 0) void checkCard(card, true);
        });
        label.append(select);
        grid.append(label);
    }

    for (const dipswitch of metadata.dipswitches ?? []) {
        const label = document.createElement("label");
        label.append(dipswitch.name);
        const select = document.createElement("select");
        select.className = "dip-select";
        select.dataset.switchName = dipswitch.name;
        const defaultSetting = dipswitch.values.find((setting) => setting.default)!;
        select.dataset.defaultValue = defaultSetting.name;
        for (const setting of dipswitch.values) {
            const option = document.createElement("option");
            option.value = setting.name;
            option.textContent = `${setting.name}${setting.default ? " (default)" : ""}`;
            select.append(option);
        }
        select.value = card.dipValues[dipswitch.name] ?? defaultSetting.name;
        select.addEventListener("change", () => {
            card.dipValues[dipswitch.name] = select.value;
            renderLibrary();
            setStatus(isRunningCard(card) ? "These game settings need a restart." : "Game settings updated.", isRunningCard(card) ? "restart-required" : "selection-changed");
        });
        label.append(select);
        grid.append(label);
    }
    panel.append(grid);

    const actions = document.createElement("div");
    actions.className = "selector-actions";
    if ((metadata.dipswitches?.length ?? 0) > 0) {
        const reset = actionButton("Reset game settings", "reset-dips", () => {
            for (const dipswitch of metadata.dipswitches ?? []) {
                card.dipValues[dipswitch.name] = dipswitch.values.find((setting) => setting.default)!.name;
            }
            renderLibrary();
            setStatus(isRunningCard(card) ? "Default game settings need a restart." : "Default game settings restored.", isRunningCard(card) ? "restart-required" : "selection-changed");
        });
        reset.disabled = Object.keys(selectedDips(card)).length === 0;
        actions.append(reset);
    }
    if (needsRestart) {
        const restart = actionButton("Restart with these choices", "restart-switches", () => { void startCard(card); });
        actions.append(restart);
    }
    if (actions.childElementCount > 0) panel.append(actions);
    if (card.warnings.length > 0) {
        const warning = document.createElement("p");
        warning.className = "selector-warning";
        warning.textContent = card.warnings.join(" ");
        panel.append(warning);
    }
    return panel;
};

// HELPER :: gameCard -> htmlElement
// Renders one game title, every expected zip, selectors and its own store/start actions.
const renderGameCard = (card: GameCard): HTMLElement => {
    const article = document.createElement("article");
    article.className = "game-card";
    article.dataset.machine = card.indexed.machine;
    article.dataset.family = card.indexed.family;
    article.dataset.selected = card.key === preloadCardKey ? "true" : "false";
    article.dataset.auditStatus = pendingForCard(card).length > 0 ? "unverified" : card.report?.status ?? card.checkState;

    const heading = document.createElement("div");
    heading.className = "card-heading";
    const titleGroup = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = card.metadata?.description ?? card.indexed.machine;
    const family = document.createElement("p");
    family.className = "family";
    family.textContent = `Runs with the ${card.indexed.family} build`;
    titleGroup.append(title, family);
    heading.append(titleGroup);
    if (isRunningCard(card)) {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = "Playing";
        heading.append(badge);
    } else if (card.key === preloadCardKey) {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = "Selected";
        heading.append(badge);
    }
    article.append(heading);

    if (card.metadata !== null) {
        const archives = document.createElement("ul");
        archives.className = "archive-list";
        for (const expected of card.metadata.archives) {
            const line = archiveLine(card, expected);
            const item = document.createElement("li");
            item.dataset.archive = expected.name;
            item.dataset.state = line.state;
            item.textContent = line.message;
            archives.append(item);
        }
        article.append(archives);
    }

    const verdict = document.createElement("p");
    verdict.className = "game-verdict";
    verdict.textContent = cardVerdict(card);
    article.append(verdict);

    const selectors = renderSelectors(card);
    if (selectors !== null) article.append(selectors);

    const actions = document.createElement("div");
    actions.className = "card-actions";
    const pending = pendingForCard(card);
    if (pending.length > 0) {
        const store = actionButton("Store and check this game", "store-card", () => { void storeArchives(new Set(pending), [card]); });
        store.disabled = libraryPromise !== null;
        actions.append(store);
    }
    const start = actionButton(isRunningCard(card) ? "Playing" : "Start", "game-start", () => { void startCard(card); });
    start.disabled = startPromise !== null || isRunningCard(card) || pending.length > 0 || card.report?.status !== "ok";
    actions.append(start);
    article.append(actions);
    return article;
};

// HELPER :: STRING -> htmlElement
// Renders a chosen or stored basename that is neither a served game nor a known companion.
const renderUnknownCard = (name: string): HTMLElement => {
    const article = document.createElement("article");
    article.className = "unknown-card";
    article.dataset.unknown = machineNameFromArchive(name);
    const title = document.createElement("h3");
    title.textContent = name;
    const message = document.createElement("p");
    message.textContent = `${machineNameFromArchive(name)} is not a game in any available build.`;
    article.append(title, message);
    return article;
};

// HELPER :: VOID -> [STRING]
// Finds source basenames not claimed by a visible game's complete archive list.
const unknownArchives = (): string[] => {
    const claimed = new Set<string>();
    for (const card of visibleCards()) for (const archive of card.metadata?.archives ?? []) claimed.add(archiveKey(archive.name));
    return [...archiveNames()].filter(([key, name]) => !claimed.has(key) && !machineIndex.has(machineNameFromArchive(name)))
        .map(([, name]) => name)
        .sort((left, right) => left.localeCompare(right));
};

// HELPER :: VOID -> VOID
// Rebuilds the responsive library from retained card state and current sources.
const renderLibrary = (): void => {
    const games = visibleCards();
    const unknown = unknownArchives();
    library.replaceChildren();
    for (const card of games) library.append(renderGameCard(card));
    for (const name of unknown) library.append(renderUnknownCard(name));
    if (games.length === 0 && unknown.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty-library";
        empty.textContent = "Drop or choose a game zip to begin.";
        library.append(empty);
    }
    const pendingClaimed = new Set(games.flatMap((card) => pendingForCard(card)));
    storeAllButton.disabled = pendingClaimed.size === 0 || libraryPromise !== null;
    const gameWord = machineIndex.size === 1 ? "game" : "games";
    librarySummary.textContent = `${machineIndex.size} ${gameWord} available across ${buildsLoaded} ${buildsLoaded === 1 ? "build" : "builds"}.`;
    updateSessionControls();
};

// HELPER :: VOID -> VOID
// Builds the byte-free stored-file list with one explicit remove action per archive.
const renderStoredFiles = (): void => {
    storedFiles.replaceChildren();
    if (storedEntries.size === 0) {
        const item = document.createElement("li");
        const text = document.createElement("span");
        text.textContent = "No files are saved in this browser.";
        item.append(text);
        storedFiles.append(item);
    } else {
        for (const entry of [...storedEntries.values()].sort((left, right) => left.name.localeCompare(right.name))) {
            const item = document.createElement("li");
            const text = document.createElement("span");
            text.textContent = `${entry.name} — ${formatSize(entry.size)}`;
            const remove = actionButton("Remove", "store-remove", () => { void removeStored(entry.name); });
            remove.disabled = libraryPromise !== null;
            item.append(text, remove);
            storedFiles.append(item);
        }
    }
    clearFilesButton.disabled = storedEntries.size === 0 || libraryPromise !== null;
};

// HELPER :: VOID -> VOID
// Applies availability for controls that require a running cabinet.
const updateSessionControls = (): void => {
    const running = cabinet?.isStarted === true;
    for (const button of sessionButtons) button.disabled = !running;
    keyboardEnabledInput.disabled = !running;
    gamepadsEnabledInput.disabled = !running;
};

// HELPER :: browserPreloadConfig, romSetMetadata -> {bios, dips, warnings}
// Applies only valid preload choices and explains each ignored stale value.
const initialChoices = (configured: BrowserPreloadConfig | null, metadata: RomSetMetadata): {
    readonly bios: string;
    readonly dips: Record<string, string>;
    readonly warnings: string[];
} => {
    const warnings: string[] = [];
    let bios = metadata.defaultBios ?? "";
    if (configured?.bios !== undefined) {
        if (metadata.bios.includes(configured.bios)) bios = configured.bios;
        else warnings.push("The preselected system version is no longer available.");
    }
    const dips: Record<string, string> = {};
    const configuredDips = configured?.dipswitches ?? {};
    const available = new Set((metadata.dipswitches ?? []).map((dipswitch) => dipswitch.name));
    for (const dipswitch of metadata.dipswitches ?? []) {
        const defaultSetting = dipswitch.values.find((setting) => setting.default)!;
        const configuredValue = configuredDips[dipswitch.name];
        if (configuredValue === undefined) dips[dipswitch.name] = defaultSetting.name;
        else if (dipswitch.values.some((setting) => setting.name === configuredValue)) dips[dipswitch.name] = configuredValue;
        else {
            dips[dipswitch.name] = defaultSetting.name;
            warnings.push(`${dipswitch.name} was reset because its preselected setting is unavailable.`);
        }
    }
    for (const name of Object.keys(configuredDips)) {
        if (!available.has(name)) warnings.push(`${name} is no longer an available game setting.`);
    }
    return { bios, dips, warnings };
};

// HELPER :: indexedMachine, BOOLEAN -> PROMISE(gameCard)
// Fetches and validates one per-game document, retaining an error card when it fails.
const loadCard = async (indexed: IndexedMachine, selected: boolean): Promise<GameCard> => {
    const key = cardKey(indexed.family, indexed.machine);
    const existing = cards.get(key);
    if (existing !== undefined) return existing;
    try {
        const response = await fetch(indexed.metadataUrl);
        if (!response.ok) throw new Error("Its game details are unavailable.");
        const parsed: unknown = await response.json();
        if (!isRomSetMetadata(parsed) || parsed.machine !== indexed.machine || parsed.family !== indexed.family) {
            throw new Error("Its game details are invalid.");
        }
        const configured = selected ? preload : null;
        const choices = initialChoices(configured, parsed);
        const card: GameCard = {
            key,
            indexed,
            metadata: parsed,
            preloadSelected: selected,
            warnings: choices.warnings,
            bios: choices.bios,
            dipValues: choices.dips,
            report: null,
            checkState: "idle",
            settingsOpen: false,
        };
        cards.set(key, card);
        return card;
    } catch (error) {
        const card: GameCard = {
            key,
            indexed,
            metadata: null,
            metadataError: errorMessage(error, "Its game details could not be loaded."),
            preloadSelected: selected,
            warnings: [],
            bios: "",
            dipValues: {},
            report: null,
            checkState: "failed",
        };
        cards.set(key, card);
        return card;
    }
};

// HELPER :: VOID -> PROMISE(VOID)
// Identifies every machine-named source, then lets known companion relationships suppress false game cards.
const discoverArchives = async (): Promise<void> => {
    const request = ++discoveryRequest;
    const wanted = new Map<string, { readonly indexed: IndexedMachine; readonly selected: boolean }>();
    for (const name of archiveNames().values()) {
        const indexed = machineIndex.get(machineNameFromArchive(name));
        if (indexed !== undefined) wanted.set(cardKey(indexed.family, indexed.machine), { indexed, selected: false });
    }
    if (preload !== null) {
        const indexed = machineIndex.get(preload.machine.toLowerCase());
        if (indexed !== undefined && indexed.family === preload.family) {
            const key = cardKey(indexed.family, indexed.machine);
            wanted.set(key, { indexed, selected: true });
            preloadCardKey = key;
        }
    }
    await Promise.all([...wanted.values()].map(({ indexed, selected }) => loadCard(indexed, selected)));
    if (request !== discoveryRequest) return;
    for (const card of cards.values()) {
        if (pendingForCard(card).length > 0) {
            card.report = null;
            card.checkState = "idle";
            delete card.checkError;
        }
    }
    renderLibrary();
};

// HELPER :: VOID -> PROMISE(VOID)
// Refreshes only byte-free metadata from IndexedDB.
const refreshStored = async (): Promise<void> => {
    if (romStore === null) return;
    storedEntries.clear();
    for (const entry of await romStore.list()) storedEntries.set(archiveKey(entry.name), entry);
    renderStoredFiles();
};

// HELPER :: gameCard -> PROMISE([romFile])
// Reads only this card's stored or preloaded archives; chosen files remain unread until confirmation.
const romFilesFor = async (card: GameCard): Promise<RomFile[]> => {
    const store = romStore;
    if (store === null || card.metadata === null) return [];
    const files: RomFile[] = [];
    for (const archive of card.metadata.archives) {
        const key = archiveKey(archive.name);
        const preloaded = preloadArchives.get(key);
        if (preloaded !== undefined) {
            const response = await fetch(preloaded.url);
            if (!response.ok) throw new Error(`${preloaded.name} could not be loaded.`);
            files.push({ name: preloaded.name, bytes: new Uint8Array(await response.arrayBuffer()) });
            continue;
        }
        const stored = storedEntries.get(key);
        if (stored === undefined) continue;
        const file = await store.get(stored.name);
        if (file !== null) files.push(file);
    }
    return files;
};

// HELPER :: gameCard, BOOLEAN -> PROMISE(VOID)
// Runs the metadata check immediately after storage, preload, removal or a BIOS choice.
const checkCard = async (card: GameCard, announce: boolean): Promise<void> => {
    if (card.metadata === null || pendingForCard(card).length > 0) return;
    card.checkState = "loading";
    card.report = null;
    renderLibrary();
    try {
        const report = RomSetAudit.audit(
            card.metadata,
            await romFilesFor(card),
            card.bios === "" ? {} : { bios: card.bios },
        );
        card.report = report;
        card.checkState = "complete";
        delete card.checkError;
        renderDetailedCheck(report, card);
        log(`Checked ${card.metadata.description}: ${report.status}.`);
        if (announce) {
            if (isRunningCard(card) && preparedChoice !== choiceSignature(card)) {
                setStatus("This choice needs a restart before it takes effect.", "restart-required");
            } else if (report.status === "ok") setStatus(`${card.metadata.description} is ready to play.`, "ready");
            else if (report.status === "bad") setStatus(cardVerdict(card), "files-bad");
            else setStatus(cardVerdict(card), "files-missing");
        }
    } catch (error) {
        card.report = null;
        card.checkState = "failed";
        card.checkError = errorMessage(error, "These files could not be checked.");
        if (announce) setStatus(card.checkError, "error");
        log(`File check failed: ${card.checkError}`);
    }
    renderLibrary();
};

// HELPER :: SET(STRING), [gameCard] -> PROMISE(VOID)
// Stores chosen archives once, then immediately checks every affected game card.
const storeArchives = async (keys: ReadonlySet<string>, affected: ReadonlyArray<GameCard>): Promise<void> => {
    if (libraryPromise !== null || romStore === null || keys.size === 0) return libraryPromise ?? Promise.resolve();
    libraryPromise = (async () => {
        try {
            renderLibrary();
            renderStoredFiles();
            setStatus("Saving the chosen files in this browser…", "storing");
            for (const key of keys) {
                const file = pendingFiles.get(key);
                if (file === undefined) continue;
                await romStore!.put({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
                pendingFiles.delete(key);
                preloadArchives.delete(key);
            }
            picker.value = "";
            await refreshStored();
            for (const card of affected) {
                card.report = null;
                card.checkState = "idle";
            }
            await discoverArchives();
            for (const card of affected) await checkCard(card, false);
            const firstFailure = affected.find((card) => card.report?.status !== "ok");
            if (firstFailure === undefined) setStatus(affected.length === 1 ? `${affected[0]!.metadata?.description ?? "The game"} is ready to play.` : "The stored games are ready to play.", "ready");
            else if (firstFailure.report?.status === "bad") setStatus(cardVerdict(firstFailure), "files-bad");
            else setStatus(cardVerdict(firstFailure), "files-missing");
        } catch (error) {
            setStatus(errorMessage(error, "The chosen files could not be stored."), "error");
            log(`Store update failed: ${errorMessage(error, "unknown storage failure")}`);
        } finally {
            libraryPromise = null;
            renderStoredFiles();
            renderLibrary();
        }
    })();
    return libraryPromise;
};

// HELPER :: [FILE] -> PROMISE(VOID)
// Accepts zip files picked or dropped anywhere and identifies them before reading their bytes.
const chooseFiles = async (files: ReadonlyArray<File>): Promise<void> => {
    const zips = files.filter((file) => /\.zip$/i.test(file.name));
    if (zips.length === 0) {
        setStatus("Choose one or more zip files.", "invalid-selection");
        return;
    }
    for (const file of zips) pendingFiles.set(archiveKey(file.name), file);
    await discoverArchives();
    const ignored = files.length - zips.length;
    setStatus(`${zips.length} ${zips.length === 1 ? "zip is" : "zips are"} ready to review${ignored === 0 ? "." : `; ${ignored} non-zip ${ignored === 1 ? "file was" : "files were"} ignored.`}`, "files-chosen");
};

// HELPER :: STRING -> PROMISE(VOID)
// Removes one local archive, keeps any running session alive, and refreshes affected card verdicts.
const removeStored = async (name: string): Promise<void> => {
    if (libraryPromise !== null || romStore === null) return libraryPromise ?? Promise.resolve();
    const key = archiveKey(name);
    libraryPromise = (async () => {
        try {
            await romStore!.remove(name);
            await refreshStored();
            const affected = [...cards.values()].filter((card) => card.metadata?.archives.some((archive) => archiveKey(archive.name) === key));
            for (const card of affected) {
                card.report = null;
                card.checkState = "idle";
                await checkCard(card, false);
            }
            await discoverArchives();
            setStatus(`${name} was removed from this browser. Saved play was not changed.`, "store-updated");
        } catch (error) {
            setStatus(errorMessage(error, "The file could not be removed."), "error");
        } finally {
            libraryPromise = null;
            renderStoredFiles();
            renderLibrary();
        }
    })();
    return libraryPromise;
};

// HELPER :: VOID -> PROMISE(VOID)
// Clears browser-local archives only; save overlays remain untouched.
const clearStored = async (): Promise<void> => {
    if (libraryPromise !== null || romStore === null) return libraryPromise ?? Promise.resolve();
    libraryPromise = (async () => {
        try {
            await romStore!.clear();
            await refreshStored();
            for (const card of cards.values()) {
                card.report = null;
                card.checkState = "idle";
                await checkCard(card, false);
            }
            await discoverArchives();
            setStatus("All saved game files were removed. Saved play was not changed.", "store-cleared");
        } catch (error) {
            setStatus(errorMessage(error, "The saved files could not be removed."), "error");
        } finally {
            libraryPromise = null;
            renderStoredFiles();
            renderLibrary();
        }
    })();
    return libraryPromise;
};

// HELPER :: VOID -> PROMISE(VOID)
// Stops and destroys the sole cabinet before another card takes the canvas and controls.
const stopCabinet = async (): Promise<void> => {
    const previous = cabinet;
    cabinet = null;
    activeCardKey = null;
    preparedChoice = "";
    clearSavesRetryButton.hidden = true;
    if (previous !== null) {
        try { await previous.destroy(); }
        catch (error) { log(`Cabinet cleanup failed: ${errorMessage(error, "unknown cleanup failure")}`); }
    }
    renderLibrary();
};

// HELPER :: gameCard -> [STRING]
// Produces store basenames or private preload URLs for only the archives present for this card.
const startSources = (card: GameCard): string[] => card.metadata === null ? [] : card.metadata.archives.flatMap((archive) => {
    const key = archiveKey(archive.name);
    const preloaded = preloadArchives.get(key);
    if (preloaded !== undefined) return [preloaded.url];
    const stored = storedEntries.get(key);
    return stored === undefined ? [] : [stored.name];
});

// HELPER :: gameCard -> PROMISE(VOID)
// Stops any prior game through ArcadeCabinet.destroy, then starts this card with its own page choices.
const startCard = async (card: GameCard): Promise<void> => {
    if (startPromise !== null) return startPromise;
    startPromise = (async () => {
        try {
            if (pendingForCard(card).length > 0) return;
            if (card.report?.status !== "ok") await checkCard(card, true);
            if (card.report?.status !== "ok" || card.metadata === null || romStore === null) return;
            if (cabinet !== null) {
                setStatus("Stopping the current game…", "stopping");
                await stopCabinet();
            }
            const dipswitches = selectedDips(card);
            const bios = card.bios.trim();
            const game = {
                machine: card.indexed.machine,
                machineHints: { players: 2 as const, buttons: 6 as const },
                roms: startSources(card),
                ...(bios === "" ? {} : { bios }),
                dipswitches,
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
                storage: ArcadeStorage.init({ key: `${card.indexed.family}/${card.indexed.machine}` }),
                romStore,
                autosave: autosaveInput.checked,
            };
            const injected = (globalThis as unknown as HarnessAdapterBoundary).__arcadeHarnessAdapter;
            const created = injected === undefined
                ? await ArcadeCabinet.init({ ...common, adapterConfig: { buildUrl: card.indexed.buildUrl } })
                : await ArcadeCabinet.init({ ...common, adapter: injected });
            cabinet = created;
            activeCardKey = card.key;
            preparedChoice = choiceSignature(card);
            created.player.on("status", (status) => {
                if (cabinet !== created) return;
                log(`Player status: ${status}.`);
                if (status === "running") setStatus("Running. Keyboard and gamepad controls are attached.", "running");
                else if (status === "paused") setStatus("Paused.", "paused");
                renderLibrary();
            });
            created.player.on("exit", () => {
                if (cabinet !== created) return;
                setStatus("The game exited. Start it again whenever you are ready.", "idle");
                renderLibrary();
            });
            created.player.on("error", (error) => log(`Player error: ${error.message}`));
            renderLibrary();
            setStatus(`Starting ${card.metadata.description}…`, "starting");
            await created.start();
            (globalThis as unknown as HarnessAdapterBoundary).__arcadeHarnessLastStartConfig = {
                ...(bios === "" ? {} : { bios }),
                dipswitches: { ...dipswitches },
            };
            try {
                await created.player.audio.unlock();
                log("Audio context unlocked from the start gesture.");
            } catch (error) {
                log(`Audio unlock needs another gesture: ${errorMessage(error, "unknown audio failure")}`);
            }
            soundButton.textContent = created.player.audio.isMuted ? "Unmute sound" : "Mute sound";
            setStatus("Running. Keyboard and gamepad controls are attached.", "running");
        } catch (error) {
            if (ArcadeRuntimeError.is(error) && error.code === ArcadeRuntimeError.CODE.OVERLAY_INCOMPATIBLE) {
                clearSavesRetryButton.hidden = false;
                cornerMenu.open = true;
                setStatus("Saved play is from a different build. Clear it and retry only if you choose to.", "overlay-incompatible");
                log("Start stopped because saved play is incompatible; nothing was cleared automatically.");
            } else {
                setStatus(errorMessage(error, "The game could not start."), "error");
                log(`Start failed: ${errorMessage(error, "unknown start failure")}`);
            }
        } finally {
            startPromise = null;
            renderLibrary();
        }
    })();
    return startPromise;
};

// HELPER :: STRING, STRING, (arcadeCabinet -> PROMISE(STRING | VOID) | STRING | VOID) -> PROMISE(VOID)
// Serializes a corner-menu action and gives each result a stable status state.
const runCabinetAction = async (
    successState: string,
    fallback: string,
    action: (selected: ArcadeCabinet) => Promise<string | void> | string | void,
): Promise<void> => {
    if (menuPromise !== null || cabinet?.isStarted !== true) return;
    const selected = cabinet;
    menuPromise = (async () => {
        try {
            const message = await action(selected);
            if (message !== undefined) setStatus(message, successState);
        } catch (error) {
            setStatus(errorMessage(error, fallback), "error");
            log(`${fallback}: ${errorMessage(error, "unknown cabinet action failure")}`);
        } finally {
            menuPromise = null;
            updateSessionControls();
        }
    })();
    return menuPromise;
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
    if (!response.ok) throw new Error("The available game list could not be loaded.");
    const value: unknown = await response.json();
    if (!Array.isArray(value) || !value.every((name) => typeof name === "string")) throw new Error("The available game list is invalid.");
    return value;
};

// HELPER :: VOID -> PROMISE(browserPreloadConfig?)
// Treats a 404 as normal no-preload mode; every other failed response is an error.
const loadPreload = async (): Promise<BrowserPreloadConfig | null> => {
    const response = await fetch("/preload.json");
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("The private preload settings could not be loaded.");
    return await response.json() as BrowserPreloadConfig;
};

// HELPER :: [STRING] -> PROMISE(VOID)
// Fetches every selected build index independently so one broken family remains non-fatal and visible.
const buildMachineIndex = async (families: ReadonlyArray<string>): Promise<void> => {
    const requested = new Set(new URLSearchParams(location.search).getAll("family")
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter((value) => value !== ""));
    const selected = requested.size === 0 ? [...families] : families.filter((family) => requested.has(family));
    const warnings: string[] = [];
    for (const family of requested) if (!families.includes(family)) warnings.push(`${family} is not an available build.`);
    await Promise.all(selected.map(async (family) => {
        const buildUrl = `/mame/${encodeURIComponent(family)}/`;
        try {
            const response = await fetch(`${buildUrl}build.json`);
            if (!response.ok) throw new Error();
            const value: unknown = await response.json();
            if (!isBuildInfo(value) || value.engine !== family) throw new Error();
            buildsLoaded++;
            const metadataBase = new URL(value.romsetsUrl.endsWith("/") ? value.romsetsUrl : `${value.romsetsUrl}/`, new URL(buildUrl, location.href));
            for (const machine of value.machines) {
                const key = machine.toLowerCase();
                if (machineIndex.has(key)) {
                    warnings.push(`${machine} appears in more than one available build, so the first one is used.`);
                    continue;
                }
                machineIndex.set(key, {
                    family,
                    machine,
                    build: value,
                    buildUrl,
                    metadataUrl: new URL(`${encodeURIComponent(machine)}.json`, metadataBase).href,
                });
            }
        } catch {
            warnings.push(`${family} could not be loaded, but the other builds are still available.`);
        }
    }));
    buildWarnings.replaceChildren();
    for (const warning of warnings) {
        const item = document.createElement("li");
        item.textContent = warning;
        buildWarnings.append(item);
    }
    buildWarnings.hidden = warnings.length === 0;
};

// HELPER :: VOID -> PROMISE(VOID)
// Loads build indexes, private preload state and the local store, then restores every identifiable card.
const initialize = async (): Promise<void> => {
    try {
        const [families, configured, store] = await Promise.all([loadBuilds(), loadPreload(), ArcadeRomStore.init()]);
        preload = configured;
        romStore = store;
        await buildMachineIndex(families);
        if (configured !== null) {
            const names = [...configured.roms, ...(configured.samples ?? [])];
            for (const [index, name] of names.entries()) {
                const url = configured.romUrls[index];
                if (url !== undefined) preloadArchives.set(archiveKey(name), { name, url });
            }
            preloadNote.hidden = false;
            preloadNote.textContent = "Private preloaded files are selected for this visit.";
        }
        await refreshStored();
        await discoverArchives();
        updateGamepads();
        for (const card of visibleCards()) {
            if (card.metadata !== null && pendingForCard(card).length === 0 && card.metadata.archives.some((archive) => hasArchive(archive.name))) {
                await checkCard(card, false);
            }
        }
        const selected = preloadCardKey === null ? undefined : cards.get(preloadCardKey);
        if (selected !== undefined && selected.report?.status === "ok") {
            if (configured?.autostart === true) {
                setStatus(`${selected.metadata?.description ?? "The selected game"} is ready. Tap or click once to start.`, "ready");
                document.addEventListener("click", () => { void startCard(selected); }, { capture: true, once: true });
            } else setStatus(`${selected.metadata?.description ?? "The selected game"} is ready to play.`, "ready");
        } else if (selected !== undefined) {
            setStatus(cardVerdict(selected), selected.report?.status === "bad" ? "files-bad" : "files-missing");
        } else if (machineIndex.size === 0) {
            setStatus("No games are available from the selected builds.", "no-builds");
        } else if ([...cards.values()].some((card) => card.report?.status === "ok")) {
            setStatus("Your saved games are ready to play.", "ready");
        } else {
            setStatus("Drop or choose your game zip files to begin.", "ready-for-files");
        }
        renderLibrary();
    } catch (error) {
        setStatus(errorMessage(error, "The arcade library could not be loaded."), "error");
        log(`Initialization failed: ${errorMessage(error, "unknown initialization failure")}`);
    }
};

picker.addEventListener("change", () => { void chooseFiles(Array.from(picker.files ?? [])); });
document.addEventListener("dragover", (event) => {
    event.preventDefault();
    document.body.dataset.dragging = "true";
    dropZone.dataset.active = "true";
});
document.addEventListener("dragleave", (event) => {
    if (event.relatedTarget === null) {
        document.body.dataset.dragging = "false";
        dropZone.dataset.active = "false";
    }
});
document.addEventListener("drop", (event) => {
    event.preventDefault();
    document.body.dataset.dragging = "false";
    dropZone.dataset.active = "false";
    void chooseFiles(Array.from(event.dataTransfer?.files ?? []));
});
storeAllButton.addEventListener("click", () => {
    const games = visibleCards();
    const keys = new Set(games.flatMap((card) => pendingForCard(card)));
    const affected = games.filter((card) => pendingForCard(card).some((key) => keys.has(key)));
    void storeArchives(keys, affected);
});
clearFilesButton.addEventListener("click", () => { void clearStored(); });

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
    return "Quick state saved. Use Save changes to keep it after closing the page.";
}); });
loadStateButton.addEventListener("click", () => { void runCabinetAction("state-loaded", "Quick state could not be loaded", async (selected) => {
    await selected.player.loadState("quick");
    return "Quick state loaded.";
}); });
persistButton.addEventListener("click", () => { void runCabinetAction("persisted", "Changes could not be saved", async (selected) => {
    const saved = await selected.save();
    return saved ? "Current changes were saved in this browser." : "There were no new changes to save.";
}); });
clearSavesButton.addEventListener("click", () => { void runCabinetAction("saves-cleared", "Saved play could not be cleared", async (selected) => {
    await selected.clearSaves();
    return "Saved play was cleared. Game files were not changed.";
}); });
clearSavesRetryButton.addEventListener("click", () => {
    void (async () => {
        const selectedCabinet = cabinet;
        const selectedCard = activeCardKey === null ? undefined : cards.get(activeCardKey);
        if (selectedCabinet === null || selectedCard === undefined) return;
        try {
            await selectedCabinet.clearSaves();
            await stopCabinet();
            setStatus("Saved play was cleared by request. Retrying…", "retrying");
            await startCard(selectedCard);
        } catch (error) {
            setStatus(errorMessage(error, "Saved play could not be cleared."), "error");
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
    void stopCabinet();
});

renderStoredFiles();
renderLibrary();
await initialize();
