// Type dependencies:
import type { FrameScheduler } from "../../src/index.ts";         // Contract this double implements

/**
 *
 * Class
 *
 */

// Double of the FrameScheduler contract: callbacks fire only when tick() is called, each receiving the virtual time it is given
export default class FakeFrameScheduler implements FrameScheduler {

    /* Instance Fields */
    private _now = 0;                                                            // Virtual time in ms passed to callbacks
    private _nextHandle = 1;                                                     // Next handle to hand out
    private readonly _pending = new Map<number, (time: number) => void>();       // Scheduled callbacks by handle

    // CONSTRUCTOR :: VOID -> this
    // Creates a scheduler at time 0 with nothing scheduled
    constructor() {}

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> NUMBER
    // Virtual time of the most recent tick in ms
    get now(): number {
        return this._now;
    }

    // GETTER :: VOID -> NUMBER
    // Number of callbacks waiting for the next tick
    get pending(): number {
        return this._pending.size;
    }

    /**
     *
     * Instance Methods
     *
     */

    // INSTANCE :: (NUMBER -> VOID) -> NUMBER
    // Schedules callback for the next tick and returns its handle
    request(callback: (time: number) => void): number {
        const handle = this._nextHandle++;
        this._pending.set(handle, callback);
        return handle;
    }

    // INSTANCE :: NUMBER -> VOID
    // Cancels a scheduled callback; unknown handles are ignored
    cancel(handle: number): void {
        this._pending.delete(handle);
    }

    // INSTANCE :: NUMBER -> VOID
    // Advances virtual time by elapsedMs and fires every callback scheduled before this tick, in request order
    // NOTE: Callbacks that request again during the tick wait for the next tick, as requestAnimationFrame behaves
    tick(elapsedMs: number): void {
        this._now += elapsedMs;
        const due = [...this._pending.entries()];
        this._pending.clear();
        for (const [, callback] of due) callback(this._now);
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method :: VOID -> fakeFrameScheduler
    // Mirrors the constructor
    static init(): FakeFrameScheduler {
        return new FakeFrameScheduler();
    }
}
