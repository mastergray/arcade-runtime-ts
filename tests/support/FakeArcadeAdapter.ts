// Type dependencies:
import type {
    ArcadeAdapter,                                                 // Contract this double implements
    ArcadeSession,                                                 // What a scripted start resolves with
    ArcadeStartConfig,                                             // Recorded argument of start()
} from "../../src/index.ts";

/**
 *
 * Type Declarations
 *
 */

// TYPE :: {mode:"resolve", session:arcadeSession} | {mode:"reject", error:UNKNOWN}
// What the next start() does.
export type FakeAdapterScript =
    | { readonly mode: "resolve"; readonly session: ArcadeSession }
    | { readonly mode: "reject"; readonly error: unknown };

/**
 *
 * Class
 *
 */

// Double of the ArcadeAdapter contract: start() resolves with a scripted session or rejects with a scripted error, and records its configs.
export default class FakeArcadeAdapter implements ArcadeAdapter {

    /* Instance Fields */
    readonly type = "fake";                                        // Adapter identity
    readonly startCalls: ArcadeStartConfig[] = [];                 // Every config start() received, in order
    private _script: FakeAdapterScript | null = null;              // Outcome of the next start(); null rejects with an Error

    // CONSTRUCTOR :: VOID -> this
    // Creates an adapter with no script
    constructor() {}

    /**
     *
     * Instance Methods
     *
     */

    // INSTANCE :: "resolve", arcadeSession -> this
    // Scripts start() to resolve with the session
    // INSTANCE :: "reject", UNKNOWN -> this
    // Scripts start() to reject with the error
    script(mode: "resolve", session: ArcadeSession): this;
    script(mode: "reject", error: unknown): this;
    script(mode: "resolve" | "reject", value: unknown): this {
        this._script = mode === "resolve"
            ? { mode, session: value as ArcadeSession }
            : { mode, error: value };
        return this;
    }

    // INSTANCE :: arcadeStartConfig -> PROMISE(arcadeSession)
    // Records the config and settles per the script; rejects with a plain Error when unscripted
    start(config: ArcadeStartConfig): Promise<ArcadeSession> {
        this.startCalls.push(config);
        const script = this._script;
        if (script === null) return Promise.reject(new Error("FakeArcadeAdapter has no script"));
        return script.mode === "resolve" ? Promise.resolve(script.session) : Promise.reject(script.error);
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method :: VOID -> fakeArcadeAdapter
    // Mirrors the constructor
    static init(): FakeArcadeAdapter {
        return new FakeArcadeAdapter();
    }
}
