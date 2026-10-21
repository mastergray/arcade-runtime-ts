// Type dependencies:
import type {
    EmscriptenModuleFactory,                                       // What a scripted load resolves with
    ModuleLoader,                                                  // Contract this double implements
} from "../../src/index.ts";

/**
 *
 * Type Declarations
 *
 */

// INTERFACE :: {url:STRING}
// One recorded load request.
export interface FakeLoadCall {
    readonly url: string;                                          // Module URL as given
}

/**
 *
 * Class
 *
 */

// Double of the ModuleLoader contract: records requested URLs and hands back a scripted factory, which itself records the options it was called with.
// NOTE: The module a factory resolves with is whatever object the test scripts; adapters narrow it privately.
export default class FakeModuleLoader {

    /* Instance Fields */
    readonly loadCalls: FakeLoadCall[] = [];                       // Every load, in order
    readonly factoryCalls: Readonly<Record<string, unknown>>[] = [];   // Options every scripted factory received, in order
    private _module: object | null = null;                         // Module the factory resolves with
    private _loadError: unknown = undefined;                       // When set, load rejects with it
    private _factoryError: unknown = undefined;                    // When set, the factory rejects with it

    // CONSTRUCTOR :: VOID -> this
    // Creates a loader with no script; its loads reject until scripted
    constructor() {}

    /**
     *
     * Properties
     *
     */

    // GETTER :: VOID -> moduleLoader
    // The injectable function form, bound to this instance
    get load(): ModuleLoader {
        return (url: string) => this.loadModule(url);
    }

    /**
     *
     * Instance Methods
     *
     */

    // INSTANCE :: OBJECT -> this
    // Scripts every subsequent factory call to resolve with module
    resolveWith(module: object): this {
        this._module = module;
        this._factoryError = undefined;
        return this;
    }

    // INSTANCE :: UNKNOWN -> this
    // Scripts load to reject with error
    rejectLoadWith(error: unknown): this {
        this._loadError = error;
        return this;
    }

    // INSTANCE :: UNKNOWN -> this
    // Scripts the factory to reject with error
    rejectFactoryWith(error: unknown): this {
        this._factoryError = error;
        return this;
    }

    // INSTANCE :: STRING -> PROMISE(emscriptenModuleFactory)
    // Records the URL and resolves with a factory per the script; rejects with a plain Error when unscripted
    loadModule(url: string): Promise<EmscriptenModuleFactory> {
        this.loadCalls.push({ url });
        if (this._loadError !== undefined) return Promise.reject(this._loadError);
        const module = this._module;
        const factoryError = this._factoryError;
        if (module === null && factoryError === undefined) return Promise.reject(new Error("FakeModuleLoader has no script"));
        return Promise.resolve((options: Readonly<Record<string, unknown>>) => {
            this.factoryCalls.push(options);
            return factoryError !== undefined ? Promise.reject(factoryError) : Promise.resolve(module as object);
        });
    }

    /**
     *
     * Static Methods
     *
     */

    // Static Factory Method :: VOID -> fakeModuleLoader
    // Mirrors the constructor
    static init(): FakeModuleLoader {
        return new FakeModuleLoader();
    }
}
