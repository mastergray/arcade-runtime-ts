// realizes: docs/ui-spec.md > §7 Local page model contracts

import type {
    ArcadeAdapter,
    ArcadeButtonCount,
    ArcadeCabinet,
    ArcadeDirection,
    ArcadeKeyName,
    BuildInfo,
    MachineInfo,
    RomSetMetadata,
    RomSetReport,
    RomStoreEntry,
} from "../../src/index.js";

export type LocalStatusState = "idle" | "loading" | "ready" | "running" | "paused" | "error";
export type LibraryCheckState = "idle" | "loading" | "complete" | "failed";
export type LocalSize = "fit" | "stretch" | "integer";
export type LocalSlot = "slot1" | "slot2" | "slot3";

export interface LocalPreloadConfig {
    readonly family: string;
    readonly machine: string;
    readonly bios?: string;
    readonly roms: ReadonlyArray<string>;
    readonly samples?: ReadonlyArray<string>;
    readonly dipswitches?: Readonly<Record<string, string>>;
    readonly autostart?: boolean;
    readonly romUrls: ReadonlyArray<string>;
}

export interface IndexedMachine {
    readonly key: string;
    readonly family: string;
    readonly machine: string;
    readonly build: BuildInfo;
    readonly buildUrl: string;
    readonly metadataUrl: string;
}

export interface LibraryCard {
    readonly key: string;
    readonly indexed: IndexedMachine;
    readonly metadata: RomSetMetadata | null;
    readonly metadataError?: string;
    readonly preloadSelected: boolean;
    readonly warnings: ReadonlyArray<string>;
    readonly report: RomSetReport | null;
    readonly checkState: LibraryCheckState;
    readonly checkError?: string;
}

export interface UnknownArchive {
    readonly name: string;
    readonly stored: boolean;
    readonly pending: boolean;
}

export type ImportRowStatus = "Ready" | "Stored" | "Pending" | "Skip";

export interface ImportRow {
    readonly key: string;
    readonly file: string;
    readonly identifiedAs: string;
    readonly status: ImportRowStatus;
    readonly details: string;
    readonly detailsTone?: "bad";                                  // Red details: the set is still missing a file
}

export interface LibrarySnapshot {
    readonly cards: ReadonlyArray<LibraryCard>;
    readonly unknown: ReadonlyArray<UnknownArchive>;
    readonly importRows: ReadonlyArray<ImportRow>;
    readonly stored: ReadonlyArray<RomStoreEntry>;
    readonly buildsLoaded: number;
    readonly gamesFound: number;
    readonly readyCount: number;
    readonly filesSaved: number;
    readonly selectedKey: string | null;
    readonly busy: boolean;
    readonly initialized: boolean;
    readonly preloadAutostart: boolean;
    readonly warnings: ReadonlyArray<string>;
}

export interface LocalAdapterBoundary {
    readonly __arcadeLocalAdapter?: ArcadeAdapter;
    __arcadeLocalCabinet?: ArcadeCabinet;
}

export interface SessionSnapshot {
    readonly mode: "local" | "presentation";
    readonly windowOpen: boolean;
    readonly windowView: "game" | "games" | "controllers";
    readonly lastFrame: string | null;
    readonly hintVisible: boolean;
    readonly status: LocalStatusState;
    readonly message: string;
    readonly activeKey: string | null;
    readonly machine: MachineInfo | null;
    readonly muted: boolean;
    readonly fullscreen: boolean;
    readonly touchDevice: boolean;
    readonly layout: { readonly width: number; readonly height: number; readonly scale: number } | null;
    readonly pads: ReadonlyArray<{ readonly player: number; readonly id: string }>;
    readonly log: ReadonlyArray<string>;
    readonly busy: boolean;
}

export interface StripControlState {
    readonly buttons: ArcadeButtonCount;
    readonly cabinet: ReadonlyArray<{ readonly id: string; readonly label: string }>;
    readonly operator: ReadonlyArray<{ readonly id: string; readonly label: string; readonly key: ArcadeKeyName }>;
}

export interface HeldStripControl {
    readonly kind: "direction" | "button";
    readonly direction?: ArcadeDirection;
    readonly button?: 1 | 2 | 3 | 4 | 5 | 6;
}

export type ModelListener = () => void;
export type Unsubscribe = () => void;

