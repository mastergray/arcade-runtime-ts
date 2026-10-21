// realizes: docs/arcade-runtime-spec.md > §16.3 W0 test doubles (the contract every later package tests against)

// Dependencies:
import CTGTest, { CTGTestPredicates as P } from "ctg-js-test";   // Pipeline API and predicate builders
import FakeArcadeAdapter from "../support/FakeArcadeAdapter.ts";   // Double under test
import FakeArcadeSession from "../support/FakeArcadeSession.ts";   // Double under test
import FakeFrameScheduler from "../support/FakeFrameScheduler.ts"; // Double under test
import FakeModuleLoader from "../support/FakeModuleLoader.ts";     // Double under test
import FakeTimer from "../support/FakeTimer.ts";                   // Double under test
import { blankFrame, rejectedBy } from "../support/fixtures.ts";   // Frame fixture and rejection capture

// Type dependencies:
import type { ArcadeStartConfig } from "../../src/index.ts";    // Config handed to the fake adapter
import type { TestFile } from "../run.ts";                       // Manifest contract consumed by the runner

/**
 *
 * Constants
 *
 */

const START_CONFIG: ArcadeStartConfig = { machine: "fake", machineHints: { players: 1, buttons: 1 }, roms: [] };   // Minimal valid start config

const testFile: TestFile = {
    label: "test doubles",
    cases: [
        {
            label: "FakeArcadeSession records calls, tracks held controls and releases them",
            run: () => CTGTest.init("session controls")
                .stage("press two controls then release one", () => {
                    const session = FakeArcadeSession.init();
                    session.setControl({ kind: "direction", player: 1, direction: "up" }, true);
                    session.setControl({ kind: "coin", player: 1 }, true);
                    session.setControl({ kind: "direction", player: 1, direction: "up" }, false);
                    return session;
                })
                .assert("held reflects the net state and calls are in order", (state) => ({
                    held: state.subject.held,
                    methods: state.subject.calls.map((call) => call.method),
                    secondArgs: state.subject.calls[1]?.args,
                }), P.equals<{ held: ReadonlyArray<string>; methods: string[]; secondArgs: ReadonlyArray<unknown> | undefined }>({
                    held: ["p1:coin"],
                    methods: ["setControl", "setControl", "setControl"],
                    secondArgs: [{ kind: "coin", player: 1 }, true],
                }))
                .start(undefined),
        },
        {
            label: "FakeArcadeSession delivers ticks, frames, sound and exit to subscribers and honours unsubscribe",
            run: () => CTGTest.init("session events")
                .stage("subscribe, emit, unsubscribe, emit again", () => {
                    const session = FakeArcadeSession.init();
                    const seen = { ticks: 0, frames: 0, sounds: 0, exits: 0 };
                    const offTick = session.onTick(() => { seen.ticks++; });
                    session.onFrame(() => { seen.frames++; });
                    session.onSound(() => { seen.sounds++; });
                    session.onExit(() => { seen.exits++; });
                    session.emitTick(3);
                    session.emitFrame(blankFrame(1, 1));
                    session.emitSound({ samples: new Float32Array(2), frames: 1 });
                    session.emitExit();
                    offTick();
                    session.emitTick();
                    return seen;
                })
                .assert("counts match", (state) => state.subject, P.equals<{ ticks: number; frames: number; sounds: number; exits: number }>({ ticks: 3, frames: 1, sounds: 1, exits: 1 }))
                .start(undefined),
        },
        {
            label: "FakeArcadeSession async methods resolve by default and follow reject and throw scripts",
            run: () => CTGTest.init("session scripts")
                .stage("exercise each mode", async () => {
                    const session = FakeArcadeSession.init();
                    const persisted = await session.persist();
                    await session.saveState("quick");
                    session.script("loadState", "reject", new Error("no state"));
                    const rejected = await rejectedBy(session.loadState("quick"));
                    session.script("pause", "throw", new Error("boom"));
                    let thrown: unknown;
                    try { session.pause(); } catch (error) { thrown = error; }
                    session.script("persist", "resolve", new Uint8Array([7]));
                    const overlay = await session.persist();
                    return { persisted, rejected: (rejected as Error).message, thrown: (thrown as Error).message, overlay: overlay === null ? null : [...overlay] };
                })
                .assert("outcomes match the scripts", (state) => state.subject, P.equals<{ persisted: Uint8Array | null; rejected: string; thrown: string; overlay: number[] | null }>({ persisted: null, rejected: "no state", thrown: "boom", overlay: [7] }))
                .start(undefined),
        },
        {
            label: "FakeArcadeAdapter rejects when unscripted, resolves with a scripted session and records configs",
            run: () => CTGTest.init("adapter")
                .stage("start unscripted then scripted", async () => {
                    const adapter = FakeArcadeAdapter.init();
                    const session = FakeArcadeSession.init();
                    const unscripted = await rejectedBy(adapter.start(START_CONFIG));
                    adapter.script("resolve", session);
                    const started = await adapter.start(START_CONFIG);
                    adapter.script("reject", new Error("nope"));
                    const rejected = await rejectedBy(adapter.start(START_CONFIG));
                    return { unscripted: unscripted instanceof Error, same: started === session, rejected: (rejected as Error).message, calls: adapter.startCalls.length, type: adapter.type };
                })
                .assert("behaviour matches", (state) => state.subject, P.equals<{ unscripted: boolean; same: boolean; rejected: string; calls: number; type: string }>({ unscripted: true, same: true, rejected: "nope", calls: 3, type: "fake" }))
                .start(undefined),
        },
        {
            label: "FakeModuleLoader records URLs and factory options and resolves with the scripted module",
            run: () => CTGTest.init("module loader")
                .stage("load and instantiate", async () => {
                    const loader = FakeModuleLoader.init();
                    const unscripted = await rejectedBy(loader.load("/mame/fake/mamefake.js"));
                    const module = { FS: {} };
                    loader.resolveWith(module);
                    const factory = await loader.load("/mame/fake/mamefake.js");
                    const instance = await factory({ noInitialRun: true });
                    loader.rejectFactoryWith(new Error("abort"));
                    const failed = await rejectedBy((await loader.load("x.js"))({}));
                    loader.rejectLoadWith(new Error("404"));
                    const notFound = await rejectedBy(loader.load("y.js"));
                    return {
                        unscripted: unscripted instanceof Error,
                        same: instance === module,
                        urls: loader.loadCalls.map((call) => call.url),
                        options: loader.factoryCalls,
                        failed: (failed as Error).message,
                        notFound: (notFound as Error).message,
                    };
                })
                .assert("records and outcomes match", (state) => state.subject, P.equals<{ unscripted: boolean; same: boolean; urls: string[]; options: Readonly<Record<string, unknown>>[]; failed: string; notFound: string }>({
                    unscripted: true, same: true, urls: ["/mame/fake/mamefake.js", "/mame/fake/mamefake.js", "x.js", "y.js"], options: [{ noInitialRun: true }, {}], failed: "abort", notFound: "404",
                }))
                .start(undefined),
        },
        {
            label: "FakeTimer fires callbacks in due order only when advanced past their time",
            run: () => CTGTest.init("timer")
                .stage("schedule three, cancel one, advance", () => {
                    const timer = FakeTimer.init();
                    const fired: string[] = [];
                    timer.setTimeout(() => fired.push("b"), 20);
                    timer.setTimeout(() => fired.push("a"), 10);
                    const c = timer.setTimeout(() => fired.push("c"), 30);
                    timer.clearTimeout(c);
                    timer.advance(5);
                    const before = [...fired];
                    timer.advance(20);
                    return { before, after: fired, pending: timer.pending, now: timer.now };
                })
                .assert("ordering and pending count", (state) => state.subject, P.equals<{ before: string[]; after: string[]; pending: number; now: number }>({ before: [], after: ["a", "b"], pending: 0, now: 25 }))
                .start(undefined),
        },
        {
            label: "FakeFrameScheduler fires requested callbacks on tick with the virtual time and defers re-requests to the next tick",
            run: () => CTGTest.init("frame scheduler")
                .stage("request, tick, re-request inside the callback", () => {
                    const scheduler = FakeFrameScheduler.init();
                    const times: number[] = [];
                    const loop = (time: number): void => { times.push(time); if (times.length < 3) scheduler.request(loop); };
                    scheduler.request(loop);
                    const cancelled = scheduler.request(() => times.push(-1));
                    scheduler.cancel(cancelled);
                    scheduler.tick(16);
                    scheduler.tick(16);
                    scheduler.tick(16);
                    scheduler.tick(16);
                    return { times, pending: scheduler.pending };
                })
                .assert("one callback per tick with accumulated time", (state) => state.subject, P.equals<{ times: number[]; pending: number }>({ times: [16, 32, 48], pending: 0 }))
                .start(undefined),
        },
    ],
};

export default testFile;
