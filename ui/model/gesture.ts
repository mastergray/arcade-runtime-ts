// realizes: docs/ui-spec.md > §1.1 Presentation menu gesture

export interface GestureSample {
    readonly id: string;
    readonly buttons: ReadonlyArray<boolean>;
}

export class MenuGestureDetector {
    private previous = new Map<string, GestureSample>();

    constructor(
        private gestures: Readonly<Record<string, ReadonlyArray<number>>>,
        private readonly fallback: ReadonlyArray<number>,
    ) {}

    update(gestures: Readonly<Record<string, ReadonlyArray<number>>>): void { this.gestures = gestures; }

    status(pad: GestureSample): { readonly buttons: ReadonlyArray<number> } | { readonly missing: true } {
        const buttons = this.gestures[pad.id] ?? this.fallback;
        return buttons.length === 0 || buttons.some((button) => !Number.isInteger(button) || button < 0 || button >= pad.buttons.length)
            ? { missing: true } : { buttons };
    }

    sample(pads: ReadonlyArray<GestureSample>): ReadonlyArray<string> {
        const fired: string[] = [];
        for (const pad of pads) {
            const status = this.status(pad);
            if ("missing" in status) continue;
            const previous = this.previous.get(pad.id);
            if (status.buttons.every((button) => pad.buttons[button])
                && !status.buttons.every((button) => previous?.buttons[button])) fired.push(pad.id);
        }
        // Retain the physical sample, so changing a binding while held is not a new press.
        this.previous = new Map(pads.map((pad) => [pad.id, { id: pad.id, buttons: [...pad.buttons] }]));
        return fired;
    }
}
