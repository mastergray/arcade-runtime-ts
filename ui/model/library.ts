// realizes: docs/ui-spec.md > §7.1 Games column and Import / Stored files flow

import {
    ArcadeRomStore,
    RomSetAudit,
    isBuildInfo,
    isRomSetMetadata,
    type RomFile,
    type AuditStrictness,
    type RomSetMetadata,
    type RomSetReport,
    type RomStoreEntry,
} from "../../src/index.js";
import type {
    ImportRow,
    IndexedMachine,
    LibraryCard,
    LibraryCheckState,
    LibrarySnapshot,
    LocalPreloadConfig,
    ModelListener,
    UnknownArchive,
    Unsubscribe,
} from "./types.js";

interface MutableCard {
    readonly key: string;
    readonly indexed: IndexedMachine;
    readonly metadata: RomSetMetadata | null;
    readonly metadataError?: string;
    readonly preloadSelected: boolean;
    readonly warnings: string[];
    report: RomSetReport | null;
    checkState: LibraryCheckState;
    checkError?: string;
}

interface MutableImportRow {
    readonly key: string;
    readonly file: string;
    identifiedAs: string;
    detailsTone?: "bad";
    status: ImportRow["status"];
    details: string;
}

export interface LibraryModelConfig {
    readonly fetch: typeof fetch;
    readonly romStore: ArcadeRomStore;
    readonly search?: string;
    readonly baseUrl: string;
    readonly strictness?: AuditStrictness;
}

export interface LibraryModelInitConfig extends Omit<LibraryModelConfig, "romStore"> {
    readonly romStore?: ArcadeRomStore;
}

const archiveKey = (name: string): string => name.toLowerCase();
const machineFromArchive = (name: string): string => name.replace(/\.zip$/i, "").toLowerCase();
const gameKey = (family: string, machine: string): string => `${family.toLowerCase()}/${machine.toLowerCase()}`;
const errorMessage = (error: unknown, fallback: string): string => error instanceof Error ? error.message : fallback;

export const formatArchiveSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
};

export class LibraryModel {
    private readonly fetch: typeof fetch;
    private readonly romStore: ArcadeRomStore;
    private readonly search: string;
    private readonly baseUrl: string;
    private readonly listeners = new Set<ModelListener>();
    private readonly machineIndex = new Map<string, IndexedMachine>();
    private readonly cards = new Map<string, MutableCard>();
    private readonly pendingFiles = new Map<string, File>();
    private readonly storedEntries = new Map<string, RomStoreEntry>();
    private readonly preloadArchives = new Map<string, { readonly name: string; readonly url: string }>();
    private readonly imports = new Map<string, MutableImportRow>();
    private warnings: string[] = [];
    private preload: LocalPreloadConfig | null = null;
    private selectedKey: string | null = null;
    private preloadCardKey: string | null = null;
    private buildsLoaded = 0;
    private busy = false;
    private initialized = false;
    private discoveryRequest = 0;
    private strictness: AuditStrictness;

    constructor(config: LibraryModelConfig) {
        this.fetch = config.fetch;
        this.romStore = config.romStore;
        this.search = config.search ?? "";
        this.baseUrl = config.baseUrl;
        this.strictness = config.strictness ?? "strict";
    }

    static async init(config: LibraryModelInitConfig): Promise<LibraryModel> {
        return new LibraryModel({ ...config, romStore: config.romStore ?? await ArcadeRomStore.init() });
    }

    get store(): ArcadeRomStore { return this.romStore; }

    subscribe(listener: ModelListener): Unsubscribe {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }

    snapshot(): LibrarySnapshot {
        const cards = this.visibleCards().map((card): LibraryCard => ({
            ...card,
            warnings: [...card.warnings],
        }));
        return {
            cards,
            unknown: this.unknownArchives(),
            importRows: [...this.imports.values()].map((row) => ({ ...row })),
            stored: [...this.storedEntries.values()].sort((left, right) => left.name.localeCompare(right.name)),
            buildsLoaded: this.buildsLoaded,
            gamesFound: cards.length,
            readyCount: cards.filter((card) => card.report?.status === "ok").length,
            filesSaved: this.storedEntries.size,
            selectedKey: this.selectedKey,
            busy: this.busy,
            initialized: this.initialized,
            preloadAutostart: this.preload?.autostart === true,
            warnings: [...this.warnings],
        };
    }

    card(key: string): LibraryCard | null {
        const card = this.cards.get(key);
        return card === undefined ? null : { ...card, warnings: [...card.warnings] };
    }

    select(key: string): void {
        if (!this.cards.has(key)) return;
        this.selectedKey = key;
        this.emit();
    }

    async initialize(): Promise<void> {
        this.setBusy(true);
        try {
            const [families, preload] = await Promise.all([this.loadBuilds(), this.loadPreload()]);
            this.preload = preload;
            await this.buildMachineIndex(families);
            if (preload !== null) {
                const names = [...preload.roms, ...(preload.samples ?? [])];
                for (const [index, name] of names.entries()) {
                    const url = preload.romUrls[index];
                    if (url !== undefined) this.preloadArchives.set(archiveKey(name), { name, url });
                }
            }
            await this.refreshStored();
            await this.discoverArchives();
            for (const card of this.visibleCards()) {
                if (card.metadata !== null && this.pendingForCard(card).length === 0
                    && card.metadata.archives.some((archive) => this.hasArchive(archive.name))) await this.checkCard(card.key, false);
            }
            if (this.selectedKey === null) this.selectedKey = this.visibleCards()[0]?.key ?? null;
            this.initialized = true;
        } finally {
            this.setBusy(false);
        }
    }

    async chooseFiles(files: ReadonlyArray<File>): Promise<void> {
        for (const file of files) {
            const key = archiveKey(file.name);
            if (!/\.zip$/i.test(file.name)) {
                this.imports.set(key, { key, file: file.name, identifiedAs: "Not a game", status: "Skip", details: "Only zip archives can be checked." });
                continue;
            }
            this.pendingFiles.set(key, file);
            this.imports.set(key, { key, file: file.name, identifiedAs: "Checking…", status: "Ready", details: "Ready to store and check." });
        }
        await this.discoverArchives();
        this.identifyImportRows();
        this.emit();
    }

    async storeAllAndCheck(): Promise<void> {
        const affected = this.visibleCards().filter((card) => this.pendingForCard(card).length > 0);
        const keys = new Set(affected.flatMap((card) => this.pendingForCard(card)));
        await this.storeArchives(keys, affected);
    }

    async storeAndCheck(key: string): Promise<void> {
        const card = this.cards.get(key);
        if (card === undefined) return;
        await this.storeArchives(new Set(this.pendingForCard(card)), [card]);
    }

    async checkCard(key: string, announce = true): Promise<void> {
        const card = this.cards.get(key);
        if (card === undefined || card.metadata === null || this.pendingForCard(card).length > 0) return;
        card.checkState = "loading";
        card.report = null;
        delete card.checkError;
        this.emit();
        try {
            const choices = this.startChoices(card.key);
            card.report = RomSetAudit.audit(card.metadata, await this.romFilesFor(card), {
                ...(choices.bios === undefined ? {} : { bios: choices.bios }),
                strictness: this.strictness,
            });
            card.checkState = "complete";
        } catch (error) {
            card.report = null;
            card.checkState = "failed";
            card.checkError = errorMessage(error, "These files could not be checked.");
        }
        if (announce) this.select(card.key);
        this.identifyImportRows();
        this.emit();
    }

    async removeArchive(name: string): Promise<void> {
        const key = archiveKey(name);
        if (this.pendingFiles.delete(key)) {
            this.imports.delete(key);
            await this.discoverArchives();
            return;
        }
        if (this.preloadArchives.delete(key)) {
            await this.afterRemoval(key);
            return;
        }
        await this.removeStored(name);
    }

    // PUBLIC :: VOID -> VOID
    // Drops the rows whose file is stored, so the next opening lists only files still waiting (ready, pending a
    // companion) or rejected ones (decided 2026-10-26: stored files live under Stored files, not in this list).
    dismissImports(): void {
        for (const [key, row] of this.imports) if (row.status === "Stored") this.imports.delete(key);
        this.emit();
    }

    async removeStored(name: string): Promise<void> {
        if (this.busy) return;
        const key = archiveKey(name);
        this.setBusy(true);
        try {
            await this.romStore.remove(name);
            await this.refreshStored();
            await this.afterRemoval(key);
        } finally {
            this.setBusy(false);
        }
    }

    async clearStored(): Promise<void> {
        if (this.busy) return;
        this.setBusy(true);
        try {
            await this.romStore.clear();
            await this.refreshStored();
            for (const card of this.cards.values()) {
                card.report = null;
                card.checkState = "idle";
            }
            await this.discoverArchives();
            for (const card of this.visibleCards()) await this.checkCard(card.key, false);
        } finally {
            this.setBusy(false);
        }
    }

    startSources(key: string): string[] {
        const card = this.cards.get(key);
        if (card?.metadata === null || card === undefined) return [];
        return card.metadata.archives.flatMap((archive) => {
            const folded = archiveKey(archive.name);
            const preload = this.preloadArchives.get(folded);
            if (preload !== undefined) return [preload.url];
            const stored = this.storedEntries.get(folded);
            return stored === undefined ? [] : [stored.name];
        });
    }

    startChoices(key: string): { readonly bios?: string; readonly dipswitches: Readonly<Record<string, string>> } {
        const card = this.cards.get(key);
        if (card?.metadata === null || card === undefined || card.key !== this.preloadCardKey || this.preload === null) return { dipswitches: {} };
        const bios = this.preload.bios !== undefined && card.metadata.bios.includes(this.preload.bios) ? this.preload.bios : undefined;
        const dipswitches: Record<string, string> = {};
        for (const field of card.metadata.dipswitches ?? []) {
            const chosen = this.preload.dipswitches?.[field.name];
            const defaultValue = field.values.find((value) => value.default)?.name;
            if (chosen !== undefined && chosen !== defaultValue && field.values.some((value) => value.name === chosen)) dipswitches[field.name] = chosen;
        }
        return { ...(bios === undefined ? {} : { bios }), dipswitches };
    }

    gamesUsing(name: string): string[] {
        const key = archiveKey(name);
        return this.visibleCards().filter((card) => card.metadata?.archives.some((archive) => archiveKey(archive.name) === key))
            .map((card) => card.metadata?.description ?? card.indexed.machine);
    }

    archiveAvailability(name: string): "pending" | "preloaded" | "stored" | "missing" {
        const key = archiveKey(name);
        if (this.pendingFiles.has(key)) return "pending";
        if (this.preloadArchives.has(key)) return "preloaded";
        if (this.storedEntries.has(key)) return "stored";
        return "missing";
    }

    pendingFor(key: string): number {
        const card = this.cards.get(key);
        return card === undefined ? 0 : this.pendingForCard(card).length;
    }

    // True when the strict check failed only on PLD entries, which MAME itself runs without: the MAME file check
    // policy (Settings › Storage, or the row's own switch) would make this game ready.
    mamePolicyWouldPass(key: string): boolean {
        const card = this.cards.get(key);
        if (card?.metadata === null || card === undefined || card.report === null || card.report.status !== "incomplete" || this.strictness === "mame") return false;
        const regionOf = new Map(card.metadata.roms.map((rom) => [`${rom.archive.toLowerCase()}/${rom.name.toLowerCase()}`, rom.region ?? ""]));
        const failures = card.report.files.filter((file) => file.status !== "ok" && card.metadata!.roms.some((rom) => !rom.optional && rom.name.toLowerCase() === file.name.toLowerCase() && rom.archive.toLowerCase() === file.archive.toLowerCase()));
        return failures.length > 0 && failures.every((file) => (regionOf.get(`${file.archive.toLowerCase()}/${file.name.toLowerCase()}`) ?? "").toLowerCase().endsWith("plds"));
    }

    verdict(key: string): string {
        const card = this.cards.get(key);
        if (card === undefined) return "Not a game";
        if (card.metadata === null) return card.metadataError ?? "Bad file";
        if (this.pendingForCard(card).length > 0) return "Not stored";
        if (card.checkState === "loading") return "Checking…";
        if (card.checkState === "failed" || card.report?.status === "bad") return "Bad file";
        if (card.report?.status === "ok") return "ready";
        return "Missing files";
    }

    companionNotice(): string | null {
        for (const card of this.visibleCards()) {
            if (card.metadata === null) continue;
            const missing = card.metadata.archives.find((archive) => !this.hasArchive(archive.name));
            if (missing !== undefined) return `${card.metadata.description} is missing ${missing.name}.`;
        }
        return null;
    }

    async setStrictness(strictness: AuditStrictness): Promise<void> {
        if (strictness === this.strictness) return;
        this.strictness = strictness;
        for (const card of this.visibleCards()) if (card.metadata !== null && this.pendingForCard(card).length === 0) {
            await this.checkCard(card.key, false);
        }
    }

    private emit(): void {
        for (const listener of this.listeners) listener();
    }

    private setBusy(value: boolean): void {
        this.busy = value;
        this.emit();
    }

    private archiveNames(): Map<string, string> {
        const names = new Map<string, string>();
        for (const entry of this.storedEntries.values()) names.set(archiveKey(entry.name), entry.name);
        for (const entry of this.preloadArchives.values()) names.set(archiveKey(entry.name), entry.name);
        for (const entry of this.pendingFiles.values()) names.set(archiveKey(entry.name), entry.name);
        return names;
    }

    private hasArchive(name: string): boolean {
        const key = archiveKey(name);
        return this.pendingFiles.has(key) || this.preloadArchives.has(key) || this.storedEntries.has(key);
    }

    private pendingForCard(card: MutableCard): string[] {
        return card.metadata?.archives.map((archive) => archiveKey(archive.name)).filter((key) => this.pendingFiles.has(key)) ?? [];
    }

    private visibleCards(): MutableCard[] {
        const sources = this.archiveNames();
        const values = [...this.cards.values()].filter((card) => card.key === this.preloadCardKey
            || card.metadata?.archives.some((archive) => sources.has(archiveKey(archive.name))) === true);
        return values.filter((candidate) => {
            if (candidate.key === this.preloadCardKey) return true;
            const primary = archiveKey(`${candidate.indexed.machine}.zip`);
            return !values.some((owner) => owner.key !== candidate.key && owner.metadata?.archives.some((archive) => archiveKey(archive.name) === primary && archive.role !== "game"));
        }).sort((left, right) => (left.metadata?.description ?? left.indexed.machine).localeCompare(right.metadata?.description ?? right.indexed.machine));
    }

    private unknownArchives(): UnknownArchive[] {
        const claimed = new Set<string>();
        for (const card of this.visibleCards()) for (const archive of card.metadata?.archives ?? []) claimed.add(archiveKey(archive.name));
        return [...this.archiveNames()].filter(([key, name]) => !claimed.has(key) && !this.machineIndex.has(machineFromArchive(name)))
            .map(([key, name]) => ({ name, stored: this.storedEntries.has(key), pending: this.pendingFiles.has(key) }))
            .sort((left, right) => left.name.localeCompare(right.name));
    }

    private async discoverArchives(): Promise<void> {
        const request = ++this.discoveryRequest;
        const wanted = new Map<string, { readonly indexed: IndexedMachine; readonly selected: boolean }>();
        for (const name of this.archiveNames().values()) {
            const indexed = this.machineIndex.get(machineFromArchive(name));
            if (indexed !== undefined) wanted.set(indexed.key, { indexed, selected: false });
        }
        if (this.preload !== null) {
            const indexed = this.machineIndex.get(this.preload.machine.toLowerCase());
            if (indexed !== undefined && indexed.family === this.preload.family) {
                wanted.set(indexed.key, { indexed, selected: true });
                this.preloadCardKey = indexed.key;
                this.selectedKey = indexed.key;
            }
        }
        await Promise.all([...wanted.values()].map(({ indexed, selected }) => this.loadCard(indexed, selected)));
        if (request !== this.discoveryRequest) return;
        for (const card of this.cards.values()) if (this.pendingForCard(card).length > 0) {
            card.report = null;
            card.checkState = "idle";
            delete card.checkError;
        }
        if (this.selectedKey === null) this.selectedKey = this.visibleCards()[0]?.key ?? null;
        this.emit();
    }

    private async loadCard(indexed: IndexedMachine, selected: boolean): Promise<MutableCard> {
        const existing = this.cards.get(indexed.key);
        if (existing !== undefined) return existing;
        try {
            const response = await this.fetch(indexed.metadataUrl);
            if (!response.ok) throw new Error("Game details are unavailable.");
            const parsed: unknown = await response.json();
            if (!isRomSetMetadata(parsed) || parsed.machine !== indexed.machine || parsed.family !== indexed.family) throw new Error("Game details are invalid.");
            const warnings: string[] = [];
            if (selected && this.preload?.bios !== undefined && !parsed.bios.includes(this.preload.bios)) warnings.push("The preselected system version is no longer available.");
            const card: MutableCard = { key: indexed.key, indexed, metadata: parsed, preloadSelected: selected, warnings, report: null, checkState: "idle" };
            this.cards.set(card.key, card);
            return card;
        } catch (error) {
            const card: MutableCard = {
                key: indexed.key,
                indexed,
                metadata: null,
                metadataError: errorMessage(error, "Game details could not be loaded."),
                preloadSelected: selected,
                warnings: [],
                report: null,
                checkState: "failed",
            };
            this.cards.set(card.key, card);
            return card;
        }
    }

    private async refreshStored(): Promise<void> {
        this.storedEntries.clear();
        for (const entry of await this.romStore.list()) this.storedEntries.set(archiveKey(entry.name), entry);
        this.emit();
    }

    private async romFilesFor(card: MutableCard): Promise<RomFile[]> {
        if (card.metadata === null) return [];
        const files: RomFile[] = [];
        for (const archive of card.metadata.archives) {
            const key = archiveKey(archive.name);
            const preload = this.preloadArchives.get(key);
            if (preload !== undefined) {
                const response = await this.fetch(preload.url);
                if (!response.ok) throw new Error(`${preload.name} could not be loaded.`);
                files.push({ name: preload.name, bytes: new Uint8Array(await response.arrayBuffer()) });
                continue;
            }
            const stored = this.storedEntries.get(key);
            if (stored === undefined) continue;
            const file = await this.romStore.get(stored.name);
            if (file !== null) files.push(file);
        }
        return files;
    }

    private async storeArchives(keys: ReadonlySet<string>, affected: ReadonlyArray<MutableCard>): Promise<void> {
        if (this.busy || keys.size === 0) return;
        this.setBusy(true);
        try {
            for (const key of keys) {
                const file = this.pendingFiles.get(key);
                if (file === undefined) continue;
                await this.romStore.put({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
                this.pendingFiles.delete(key);
                this.preloadArchives.delete(key);
            }
            await this.refreshStored();
            await this.discoverArchives();
            for (const card of affected) await this.checkCard(card.key, false);
            this.identifyImportRows();
        } finally {
            this.setBusy(false);
        }
    }

    private async afterRemoval(key: string): Promise<void> {
        for (const card of this.cards.values()) if (card.metadata?.archives.some((archive) => archiveKey(archive.name) === key)) {
            card.report = null;
            card.checkState = "idle";
            await this.checkCard(card.key, false);
        }
        await this.discoverArchives();
        this.identifyImportRows();
        this.emit();
    }

    private identifyImportRows(): void {
        for (const row of this.imports.values()) {
            if (row.status === "Skip" && !/\.zip$/i.test(row.file)) continue;
            const card = this.visibleCards().find((candidate) => candidate.metadata?.archives.some((archive) => archiveKey(archive.name) === row.key));
            if (card === undefined || card.metadata === null) {
                row.identifiedAs = "Not a game";
                row.status = "Skip";
                row.details = "No available build identifies this archive.";
                continue;
            }
            const archive = card.metadata.archives.find((entry) => archiveKey(entry.name) === row.key)!;
            row.identifiedAs = archive.role === "game" ? card.metadata.description : `${card.metadata.description} (${archive.role})`;
            const missing = card.metadata.archives.find((entry) => !this.hasArchive(entry.name));
            if (this.pendingFiles.has(row.key)) {
                row.status = "Ready";
                row.details = missing === undefined ? "Ready to store and check." : `Missing files: ${missing.name}.`;
                row.detailsTone = missing === undefined ? undefined : "bad";
            } else if (missing !== undefined || card.report?.status === "incomplete") {
                row.status = "Pending";
                row.details = `Missing files: ${missing?.name ?? "another archive"}.`;
                row.detailsTone = "bad";
            } else if (card.report?.status === "bad") {
                row.status = "Skip";
                row.details = "The stored archive does not match the available build.";
            } else {
                row.status = "Stored";
                row.details = "Stored and checked.";
            }
        }
    }

    private async loadBuilds(): Promise<string[]> {
        const response = await this.fetch("/builds.json");
        if (!response.ok) throw new Error("The available game list could not be loaded.");
        const value: unknown = await response.json();
        if (!Array.isArray(value) || !value.every((name) => typeof name === "string")) throw new Error("The available game list is invalid.");
        return value;
    }

    private async loadPreload(): Promise<LocalPreloadConfig | null> {
        const response = await this.fetch("/preload.json");
        if (response.status === 404) return null;
        if (!response.ok) throw new Error("The private preload settings could not be loaded.");
        // A deployment answers this probe with a literal null rather than a 404, which a shared host may serve slowly
        // through its error document; both mean "no preload" (2026-10-31).
        const value: unknown = await response.json();
        return value === null ? null : value as LocalPreloadConfig;
    }

    private async buildMachineIndex(families: ReadonlyArray<string>): Promise<void> {
        const requested = new Set(new URLSearchParams(this.search).getAll("family").flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean));
        const selected = requested.size === 0 ? [...families] : families.filter((family) => requested.has(family));
        const warnings: string[] = [];
        for (const family of requested) if (!families.includes(family)) warnings.push(`${family} is not an available build.`);
        await Promise.all(selected.map(async (family) => {
            const buildUrl = `/mame/${encodeURIComponent(family)}/`;
            try {
                const response = await this.fetch(`${buildUrl}build.json`);
                if (!response.ok) throw new Error();
                const value: unknown = await response.json();
                if (!isBuildInfo(value) || value.engine !== family) throw new Error();
                this.buildsLoaded++;
                const metadataBase = new URL(value.romsetsUrl.endsWith("/") ? value.romsetsUrl : `${value.romsetsUrl}/`, new URL(buildUrl, this.baseUrl));
                for (const machine of value.machines) {
                    const folded = machine.toLowerCase();
                    if (this.machineIndex.has(folded)) {
                        warnings.push(`${machine} appears in more than one available build, so the first one is used.`);
                        continue;
                    }
                    this.machineIndex.set(folded, {
                        key: gameKey(family, machine), family, machine, build: value, buildUrl,
                        metadataUrl: new URL(`${encodeURIComponent(machine)}.json`, metadataBase).href,
                    });
                }
            } catch {
                warnings.push(`${family} could not be loaded, but the other builds are still available.`);
            }
        }));
        this.warnings = warnings;
    }
}
