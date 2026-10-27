// realizes: docs/ui-spec.md > §3.4 and §7 Controls dialog

import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import {
    DEFAULT_ANALOG_SETTING,
    DEFAULT_KEYBOARD_MAP,
    arcadeControlKey,
    type AnalogSetting,
    type AnalogSettings,
    type ArcadeAxis,
    type ArcadeControl,
    type GamepadDevice,
    type GamepadLike,
    type GamepadMapping,
    type KeyboardMap,
    type MachineAnalogKind,
    type MachineInfo,
    type PlayerIndex,
} from "../../src/index.js";
import { Bar, Button, Chip, Confirm, ControlsPicture, Modal, Range, Selector, Table, Tabs } from "../kit/index.js";
import {
    BindingCapture,
    gamepadButtonFor,
    gamepadButtonLabel,
    gamepadChordLabel,
    keyLabel,
    keyboardCodeFor,
    moveGamepadBinding,
    moveKeyboardBinding,
    type CaptureResult,
} from "../model/bindings.js";
import { FocusProvider } from "../focus/FocusController.js";
import { type PreferenceStore } from "../model/preferences.js";
import type { SessionModel } from "../model/session.js";

type ControlsTab = "player1" | "player2" | "cabinet" | "analogue" | "test";
type ApplyScope = "game" | "global";
type CaptureTarget =
    | { readonly id: string; readonly kind: "control"; readonly control: ArcadeControl; readonly chord: boolean; readonly modifier?: number }
    | { readonly id: string; readonly kind: "menu" };

export interface ControlsModalProps {
    readonly inline?: boolean;
    readonly preferences: PreferenceStore;
    readonly session: SessionModel | null;
    readonly gameKey: string | null;
    readonly gameName: string | null;
    readonly machine: MachineInfo | null;
    readonly onClose: () => void;
    readonly onApplied: () => void;
}

const directions = ["up", "down", "left", "right"] as const;
const directionLabels = { up: "▲", down: "▼", left: "◀", right: "▶" } as const;

const controlsForPlayer = (player: PlayerIndex): ReadonlyArray<{ readonly label: string; readonly control: ArcadeControl }> => [
    ...directions.map((direction) => ({ label: directionLabels[direction], control: { kind: "direction" as const, player, direction } })),
    ...([1, 2, 3, 4, 5, 6] as const).map((button) => ({ label: `B${button}`, control: { kind: "button" as const, player, button } })),
    { label: "COIN", control: { kind: "coin", player } },
    { label: "START", control: { kind: "start", player } },
];

const analogName = (kind: MachineAnalogKind, player: PlayerIndex): string => {
    const names: Partial<Record<MachineAnalogKind, string>> = {
        "stick-x": "Horizontal stick", "stick-y": "Vertical stick", "stick-z": "Stick depth",
        paddle: "Steering / paddle", "paddle-v": "Vertical paddle",
        "pedal-1": "Pedal 1", "pedal-2": "Pedal 2", "pedal-3": "Pedal 3",
        dial: "Dial", "dial-v": "Vertical dial", "trackball-x": "Trackball horizontal", "trackball-y": "Trackball vertical",
        "lightgun-x": "Light gun horizontal", "lightgun-y": "Light gun vertical",
        "mouse-x": "Pointer horizontal", "mouse-y": "Pointer vertical",
        positional: "Positional horizontal", "positional-v": "Positional vertical",
    };
    return `P${player} ${names[kind] ?? kind}`;
};

const rawPads = (): ReadonlyArray<GamepadLike | null> => Array.from(navigator.getGamepads?.() ?? []) as unknown as ReadonlyArray<GamepadLike | null>;

const padForPlayer = (devices: ReadonlyArray<GamepadDevice>, player: PlayerIndex): GamepadDevice | null =>
    devices.find((device) => device.player === player) ?? devices[player - 1] ?? null;

const mappingFor = (mappings: Readonly<Record<string, GamepadMapping>>, pad: GamepadDevice | null): GamepadMapping =>
    pad === null ? {} : mappings[pad.id] ?? { id: pad.id };

const gamepadLabelFor = (mapping: GamepadMapping, control: ArcadeControl): string => {
    const button = gamepadButtonFor(mapping, control);
    if (button === null) return "unbound";
    if (control.kind === "direction" || control.kind === "button" || control.kind === "coin" || control.kind === "start") {
        return gamepadButtonLabel(button);
    }
    const modifier = mapping.chords === false ? mapping.coin ?? 8 : mapping.chords?.modifier ?? mapping.coin ?? 8;
    return gamepadChordLabel([modifier, button]);
};

const copyMappings = (source: Readonly<Record<string, GamepadMapping>>): Record<string, GamepadMapping> =>
    Object.fromEntries(Object.entries(source).map(([id, mapping]) => [id, { ...mapping, id }]));

const settingFor = (settings: AnalogSettings, key: keyof AnalogSettings): Required<AnalogSetting> => ({
    keySpeed: settings[key]?.keySpeed ?? DEFAULT_ANALOG_SETTING.keySpeed,
    centreSpeed: settings[key]?.centreSpeed ?? settings[key]?.keySpeed ?? DEFAULT_ANALOG_SETTING.centreSpeed,
    travel: settings[key]?.travel ?? DEFAULT_ANALOG_SETTING.travel,
    invert: settings[key]?.invert ?? DEFAULT_ANALOG_SETTING.invert,
});

const meterValue = (value: number): 0 | 25 | 50 | 75 | 100 => {
    const normalized = Math.max(0, Math.min(100, Math.round(Math.abs(value) * 100)));
    return (normalized < 13 ? 0 : normalized < 38 ? 25 : normalized < 63 ? 50 : normalized < 88 ? 75 : 100);
};

const axisKindFor = (kind: MachineAnalogKind): ArcadeAxis["kind"] | null => {
    if (kind === "stick-x" || kind === "paddle" || kind === "positional" || kind === "lightgun-x") return "stick-x";
    if (kind === "stick-y" || kind === "paddle-v" || kind === "positional-v" || kind === "lightgun-y") return "stick-y";
    if (kind === "stick-z") return "stick-z";
    if (kind === "pedal-1" || kind === "pedal-2") return kind;
    if (kind === "dial" || kind === "trackball-x" || kind === "mouse-x") return "spin-x";
    if (kind === "dial-v" || kind === "trackball-y" || kind === "mouse-y") return "spin-y";
    return null;
};

export function ControlsModal(props: ControlsModalProps) {
    const resolved = useMemo(() => props.preferences.resolveGame(props.gameKey ?? "defaults/defaults"), [props.preferences, props.gameKey]);
    const originalAnalog = useRef(resolved.analog);
    const applied = useRef(false);
    const capture = useRef(new BindingCapture());
    const [tab, setTab] = useState<ControlsTab>("player1");
    const [scope, setScope] = useState<ApplyScope>(props.gameKey === null ? "global" : "game");
    const [keyboard, setKeyboard] = useState<KeyboardMap>(resolved.controls.keyboard ?? DEFAULT_KEYBOARD_MAP);
    const [mappings, setMappings] = useState<Record<string, GamepadMapping>>(() => copyMappings(resolved.controls.gamepads));
    const [gestures, setGestures] = useState<Record<string, ReadonlyArray<number>>>(() => ({ ...resolved.controls.menuGesture }));
    const [deadZone, setDeadZone] = useState(resolved.controls.stickCentre);
    const [analog, setAnalog] = useState<AnalogSettings>(resolved.analog);
    const [globalAnalog, setGlobalAnalog] = useState<AnalogSettings>(() => props.preferences.getGlobal().analog);
    const [analogTouched, setAnalogTouched] = useState<ReadonlySet<string>>(new Set());
    const [captureTarget, setCaptureTarget] = useState<CaptureTarget | null>(null);
    const [confirmRestore, setConfirmRestore] = useState(false);
    const [clearGameControls, setClearGameControls] = useState(false);
    const [clearGameAnalog, setClearGameAnalog] = useState(false);
    const [held, setHeld] = useState<ReadonlySet<string>>(new Set());
    const [, setInputVersion] = useState(0);
    const devices = props.session?.controlDevices() ?? [];

    useEffect(() => () => {
        // Closing the presentation window through its gesture also cancels live previews.
        if (props.inline && !applied.current) props.session?.previewAnalog(originalAnalog.current);
    }, [props.inline, props.session]);

    const finishCapture = (result: CaptureResult, target: CaptureTarget): void => {
        if (target.kind === "menu") {
            if (result.device === "gamepad") setGestures((current) => ({ ...current, [result.padId]: result.buttons }));
            setCaptureTarget(null);
            return;
        }
        if (scope === "game") setClearGameControls(false);
        if (result.device === "keyboard") setKeyboard((current) => moveKeyboardBinding(current, target.control, result.code));
        else setMappings((current) => ({
            ...current,
            [result.padId]: moveGamepadBinding(current[result.padId] ?? { id: result.padId }, target.control, result.buttons[result.buttons.length - 1] ?? 0, target.chord),
        }));
        setCaptureTarget(null);
    };

    useEffect(() => {
        if (captureTarget === null) return;
        capture.current.begin({
            id: captureTarget.id,
            mode: captureTarget.kind === "menu" ? "gesture" : captureTarget.chord ? "chord" : "binding",
            ...(captureTarget.kind === "control" && captureTarget.modifier !== undefined ? { modifier: captureTarget.modifier } : {}),
        }, rawPads());
        const key = (event: KeyboardEvent): void => {
            event.preventDefault();
            event.stopPropagation();
            const snapshot = capture.current.key(event.code);
            if (snapshot.cancelled) setCaptureTarget(null);
            else if (snapshot.result !== null) finishCapture(snapshot.result, captureTarget);
        };
        let handle = 0;
        const poll = (): void => {
            const snapshot = capture.current.sample(rawPads());
            if (snapshot.result !== null) finishCapture(snapshot.result, captureTarget);
            else if (snapshot.request !== null) handle = requestAnimationFrame(poll);
        };
        window.addEventListener("keydown", key, true);
        handle = requestAnimationFrame(poll);
        return () => { window.removeEventListener("keydown", key, true); cancelAnimationFrame(handle); };
    }, [captureTarget]);

    useEffect(() => {
        if (tab !== "test" || props.session?.cabinet === null || props.session?.cabinet === undefined) return;
        const input = props.session.cabinet.player.input;
        setHeld(new Set(input.snapshot.map(arcadeControlKey)));
        const unsubscribe = input.onHold((control, pressed) => {
            setHeld((current) => {
                const next = new Set(current);
                if (pressed) next.add(arcadeControlKey(control)); else next.delete(arcadeControlKey(control));
                return next;
            });
            return true;
        });
        const timer = window.setInterval(() => setInputVersion((value) => value + 1), 50);
        return () => { unsubscribe(); window.clearInterval(timer); };
    }, [tab, props.session]);

    const begin = (target: CaptureTarget): void => setCaptureTarget(target);
    const currentPad = (player: PlayerIndex): GamepadDevice | null => padForPlayer(devices, player);
    const currentMapping = (player: PlayerIndex): GamepadMapping => mappingFor(mappings, currentPad(player));
    const captureButton = (target: CaptureTarget): ReactElement => <Button size="sm"
        label={captureTarget?.id === target.id ? "Press a key or button…" : "Change…"}
        data-binding-change={target.id}
        data-capturing={captureTarget?.id === target.id}
        onClick={() => begin(target)} />;

    const scopeChoice = (name: string): ReactElement => props.inline
        ? <div className="scope-choice" data-apply-scope><span>Apply to</span><Selector id={`${name}-scope`} label="Apply to" values={props.gameKey === null ? ["all games"] : ["this game", "all games"]} value={scope === "game" ? "this game" : "all games"} onChange={(value) => setScope(value === "this game" ? "game" : "global")} /></div>
        : <fieldset className="scope-choice" data-apply-scope><legend>Apply to</legend>
            <label><input type="radio" name={`${name}-scope`} value="game" checked={scope === "game"} disabled={props.gameKey === null} onChange={() => setScope("game")} /> this game</label>
            <label><input type="radio" name={`${name}-scope`} value="global" checked={scope === "global"} onChange={() => setScope("global")} /> all games</label>
        </fieldset>;

    const playerPane = (player: PlayerIndex): ReactElement => {
        const pad = currentPad(player);
        const map = currentMapping(player);
        return <div className="controls-pane" data-controls-tab={`player${player}`}>
            <p className="device-line" data-controls-device={`player${player}`}>Keyboard ({player === 1 ? "left-hand set" : "right-hand set"}) · {pad === null ? `Gamepad ${player} not connected` : `${pad.id} (${pad.standard ? "standard layout" : "custom layout"})`} · Touch {props.session?.snapshot().touchDevice ? "controller available" : "device not detected"}</p>
            <ControlsPicture player={player} buttons={props.machine?.buttons ?? 6} />
            <Table phoneGroups={[{ label: "Control", columns: [0, 3] }, { label: "Keyboard", columns: [1] }, { label: "Gamepad", columns: [2] }]} id={`player-${player}-bindings`} columns={["Control", "Keyboard", `Gamepad ${player}`, "Change…"]} rows={controlsForPlayer(player).map(({ label, control }) => ({
                id: arcadeControlKey(control),
                dim: control.kind === "button" && control.button > (props.machine?.buttons ?? 6),
                focusable: true,
                onActivate: () => begin({ id: arcadeControlKey(control), kind: "control", control, chord: false }),
                cells: [label, keyLabel(keyboardCodeFor(keyboard, control)), gamepadButtonLabel(gamepadButtonFor(map, control)), captureButton({ id: arcadeControlKey(control), kind: "control", control, chord: false })],
            }))} />
            {scopeChoice("controls")}
        </div>;
    };

    const cabinetControls: ReadonlyArray<{ readonly label: string; readonly control: ArcadeControl }> = [
        { label: "Service", control: { kind: "service" } },
        { label: "Test", control: { kind: "test" } },
        { label: "Tilt", control: { kind: "tilt" } },
        ...(props.machine?.inputs.volume ? [
            { label: "Volume down", control: { kind: "volume" as const, direction: "down" as const } },
            { label: "Volume up", control: { kind: "volume" as const, direction: "up" as const } },
        ] : []),
        ...(props.machine?.inputs.keys.map((item) => ({ label: item.name, control: { kind: "key" as const, key: item.key } })) ?? []),
    ];
    const cabinetPad = devices[0] ?? null;
    const cabinetMap = mappingFor(mappings, cabinetPad);
    const cabinetRows = cabinetControls.map(({ label, control }) => {
        const button = gamepadButtonFor(cabinetMap, control);
        const modifier = cabinetMap.chords === false ? cabinetMap.coin ?? 8 : cabinetMap.chords?.modifier ?? cabinetMap.coin ?? 8;
        const id = `cabinet:${arcadeControlKey(control)}`;
        return {
            id,
            focusable: true,
            onActivate: () => begin({ id, kind: "control" as const, control, chord: true, modifier }),
            cells: [label, keyLabel(keyboardCodeFor(keyboard, control)), button === null ? "unbound" : gamepadChordLabel([modifier, button]), captureButton({ id, kind: "control", control, chord: true, modifier })],
        };
    });
    const menuPadId = cabinetPad?.id ?? Object.keys(gestures)[0] ?? "";
    const menuButtons = menuPadId === "" ? [10, 11] : gestures[menuPadId] ?? [10, 11];
    const cabinetPane = <div className="controls-pane" data-controls-tab="cabinet">
        <p className="note">Gamepad cabinet actions are captured while Select is held.</p>
        <Table phoneGroups={[{ label: "Control", columns: [0, 3] }, { label: "Keyboard", columns: [1] }, { label: "Gamepad", columns: [2] }]} id="cabinet-bindings" columns={["Control", "Keyboard", "Gamepad (hold Select +)", "Change…"]} rows={[
            ...cabinetRows,
            { id: "menu-gesture", focusable: true, onActivate: () => begin({ id: "menu-gesture", kind: "menu" }), cells: ["Open the menu while playing", "Escape", gamepadChordLabel(menuButtons), captureButton({ id: "menu-gesture", kind: "menu" })] },
        ]} />
        {scopeChoice("cabinet")}
    </div>;

    const updateAnalog = (key: keyof AnalogSettings, changes: Partial<AnalogSetting>): void => {
        const next = { ...analog, [key]: { ...settingFor(analog, key), ...changes } } as AnalogSettings;
        setAnalog(next);
        setAnalogTouched((current) => new Set(current).add(String(key)));
        props.session?.previewAnalog(next);
    };
    const analogPane = <div className="controls-pane" data-controls-tab="analogue">
        {props.machine === null ? <p className="note" data-analogue-disabled>No game is running. Start a game to edit its declared analogue controls.</p> : <>
            <Table phoneStacked id="analogue-settings" columns={["Control", "Keyboard speed", "Gamepad travel", "Invert", "All games"]} rows={props.machine.inputs.analog.map(({ player, kind }) => {
                const key = `p${player}:${kind}` as keyof AnalogSettings;
                const setting = settingFor(analog, key);
                return {
                    id: String(key),
                    cells: [
                        analogName(kind, player),
                        props.inline ? <Selector id={`${key}-speed`} label="Keyboard speed" values={Array.from({ length: 40 }, (_, index) => `${(index + 1) / 2} %`)} value={`${setting.keySpeed * 100} %`} onChange={(value) => updateAnalog(key, { keySpeed: parseFloat(value) / 100 })} key="speed" /> : <Range label="Speed" aria-label={`${analogName(kind, player)} keyboard speed`} min={0.5} max={20} step={0.5} value={setting.keySpeed * 100} valueLabel={`${(setting.keySpeed * 100).toFixed(1)} %`} onChange={(value) => updateAnalog(key, { keySpeed: value / 100 })} key="speed" />,
                        props.inline ? <Selector id={`${key}-travel`} label="Gamepad travel" values={Array.from({ length: 40 }, (_, index) => `${(index + 1) * 10} %`)} value={`${Math.round(setting.travel * 100)} %`} onChange={(value) => updateAnalog(key, { travel: parseFloat(value) / 100 })} key="travel" /> : <Range label="Travel" aria-label={`${analogName(kind, player)} gamepad travel`} min={10} max={400} step={10} value={setting.travel * 100} valueLabel={`${Math.round(setting.travel * 100)} %`} onChange={(value) => updateAnalog(key, { travel: value / 100 })} key="travel" />,
                        props.inline ? <Selector id={`${key}-invert`} label="Invert" values={["Off", "On"]} value={setting.invert ? "On" : "Off"} onChange={(value) => updateAnalog(key, { invert: value === "On" })} key="invert" /> : <input aria-label={`Invert ${analogName(kind, player)}`} data-analog-invert={String(key)} type="checkbox" checked={setting.invert} onChange={(event) => updateAnalog(key, { invert: event.currentTarget.checked })} key="invert" />,
                        <Button size="sm" label="Use for all games" data-analog-global={String(key)} onClick={() => {
                            setGlobalAnalog((current) => ({ ...current, [key]: setting }));
                        }} key="global" />,
                    ],
                };
            })} />
        </>}
        {props.inline ? <Selector id="stick-centre" label="Stick centre tolerance" values={Array.from({ length: 91 }, (_, index) => `${index} %`)} value={`${Math.round(deadZone * 100)} %`} onChange={(value) => setDeadZone(parseFloat(value) / 100)} /> : <Range data-stick-centre label="Stick centre tolerance" min={0} max={90} step={1} value={deadZone * 100} valueLabel={`${Math.round(deadZone * 100)} %`} onChange={(value) => setDeadZone(value / 100)} />}
        <p className="note">How far a stick must move before it counts; applies to every pad and every game.</p>
    </div>;

    const testControls = [...controlsForPlayer(1), ...controlsForPlayer(2), ...cabinetControls];
    const input = props.session?.cabinet?.player.input;
    const testRows = testControls.map(({ label, control }) => {
        const key = arcadeControlKey(control);
        const p1 = mappingFor(mappings, devices[0] ?? null);
        const p2 = mappingFor(mappings, devices[1] ?? null);
        return {
            id: `test:${key}`,
            held: held.has(key),
            cells: [label, keyLabel(keyboardCodeFor(keyboard, control)), gamepadLabelFor(p1, control), gamepadLabelFor(p2, control), <Chip label={held.has(key) ? "held" : "—"} on={held.has(key)} key="now" />],
        };
    });
    const analogTestRows = props.machine?.inputs.analog.map(({ player, kind }) => {
        const axisKind = axisKindFor(kind);
        const value = axisKind === null ? 0 : input?.axes.find((entry) => entry.axis.player === player && entry.axis.kind === axisKind)?.value ?? 0;
        return { id: `test:p${player}:${kind}`, cells: [analogName(kind, player), "axis", "axis", "axis", <Bar value={meterValue(value)} label={`${analogName(kind, player)} input`} key="now" />] };
    }) ?? [];
    const testPane = <div className="controls-pane" data-controls-tab="test">
        <p className="note">Inputs are shown here but remain isolated from the running game.</p>
        <Table phoneGroups={[{ label: "Control", columns: [0, 4] }, { label: "Keyboard", columns: [1] }, { label: "Gamepad 1 / 2", columns: [2, 3] }]} id="test-input" columns={["Function", "Keyboard", "Gamepad 1", "Gamepad 2", "Now"]} rows={[...testRows, ...analogTestRows]} />
    </div>;

    const restore = (): void => {
        if (scope === "global") {
            setKeyboard(DEFAULT_KEYBOARD_MAP);
            setMappings({});
            setGestures({});
            setDeadZone(0.25);
            setGlobalAnalog({});
            setClearGameControls(true);
            const gameAnalog = props.gameKey === null ? {} : props.preferences.getGame(props.gameKey).analog ?? {};
            setAnalog(gameAnalog);
            setAnalogTouched(new Set());
            props.session?.previewAnalog(gameAnalog);
        } else {
            const global = props.preferences.getGlobal();
            setKeyboard(global.controls.keyboard ?? DEFAULT_KEYBOARD_MAP);
            setMappings(copyMappings(global.controls.gamepads));
            setAnalog(global.analog);
            setAnalogTouched(new Set());
            setClearGameControls(true);
            setClearGameAnalog(true);
            props.session?.previewAnalog(global.analog);
        }
    };
    const apply = (): void => {
        applied.current = true;
        const global = props.preferences.getGlobal();
        props.preferences.setGlobal({
            ...global,
            controls: {
                ...global.controls,
                ...(scope === "global" ? { keyboard, gamepads: mappings } : {}),
                menuGesture: gestures,
                stickCentre: deadZone,
            },
            analog: globalAnalog,
        });
        if (props.gameKey !== null) {
            const game = props.preferences.getGame(props.gameKey);
            const nextAnalog = clearGameAnalog ? {} as Record<string, AnalogSetting> : { ...game.analog } as Record<string, AnalogSetting>;
            for (const key of analogTouched) {
                const setting = analog[key as keyof AnalogSettings];
                if (setting !== undefined) nextAnalog[key] = setting;
            }
            props.preferences.setGame(props.gameKey, {
                ...game,
                ...(scope === "game" ? { controls: clearGameControls ? undefined : { keyboard, gamepads: mappings } } : clearGameControls ? { controls: undefined } : {}),
                ...(Object.keys(nextAnalog).length === 0 ? { analog: undefined } : { analog: nextAnalog as AnalogSettings }),
            });
        }
        void props.session?.applyPreferences();
        props.onApplied();
        props.onClose();
    };
    const cancel = (): void => {
        props.session?.previewAnalog(originalAnalog.current);
        props.onClose();
    };

    const foot = <>
        <Button label="Restore defaults" data-controls-restore onClick={() => setConfirmRestore(true)} />
        <Button label="OK" primary data-controls-ok onClick={apply} />
        <Button label="Cancel" data-controls-cancel onClick={cancel} />
    </>;
    const content = <>
        <Tabs arrowSelect={props.inline} id="controls-tabs" active={tab} onChange={(id) => setTab(id as ControlsTab)} tabs={[
            { id: "player1", label: "Player 1", shortLabel: "P1" }, { id: "player2", label: "Player 2", shortLabel: "P2" },
            { id: "cabinet", label: "Cabinet" }, { id: "analogue", label: "Analogue" }, { id: "test", label: "Test input", shortLabel: "Test" },
        ]} />
        {tab === "player1" ? playerPane(1) : tab === "player2" ? playerPane(2) : tab === "cabinet" ? cabinetPane : tab === "analogue" ? analogPane : testPane}
    </>;
    const body = <div data-modal={props.inline ? undefined : "controls"} data-controls-inline={props.inline || undefined}>
        {props.inline ? <><div className="inline-controls-body">{content}</div><footer className="modal-foot">{foot}</footer></> : <Modal title={`Controls — ${props.gameName ?? "defaults"}`} onClose={cancel} foot={foot}>{content}</Modal>}
    {confirmRestore ? <FocusProvider onBack={() => setConfirmRestore(false)}><div data-modal="restore-controls"><Confirm veil question={`Restore controls for ${scope === "game" ? "this game" : "all games"}?`} consequence={scope === "game" ? "This game's own keyboard and gamepad bindings are removed; it uses the all-games bindings again. Saved play is untouched." : "Keyboard and gamepad bindings for all games return to the built-in defaults, and this game's own bindings are removed. Saved play is untouched."} confirmLabel="Restore defaults" onCancel={() => setConfirmRestore(false)} onConfirm={() => { setConfirmRestore(false); restore(); }} /></div></FocusProvider> : null}
    </div>;
    const stepTab = (step: number): void => {
        const tabs: ControlsTab[] = ["player1", "player2", "cabinet", "analogue", "test"];
        setTab(tabs[(tabs.indexOf(tab) + step + tabs.length) % tabs.length]!);
    };
    return props.inline ? <FocusProvider initialId="controls-tabs-player1" escapeEnabled={false} keyboardEnabled={captureTarget === null && !confirmRestore} gamepadEnabled={captureTarget === null && !confirmRestore}
        acceptGamepad={(pad) => props.session?.snapshot().windowOpen === true && !(resolved.controls.menuGesture[pad.id] ?? [10, 11]).every((button) => pad.buttons[button]?.pressed)}
        onBack={() => { if (confirmRestore) setConfirmRestore(false); else cancel(); }} onTabPrevious={() => stepTab(-1)} onTabNext={() => stepTab(1)}>{body}</FocusProvider> : body;
}
