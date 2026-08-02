import React, { useMemo, useRef, useState } from "react";
import { PixelEditor } from "./PixelEditor";
import { Tester } from "./Tester";
import {
  ACTION_SPECS,
  BEHAVIOR_SPECS,
  COND_SPECS,
  OP_OPTIONS,
  PATTERN_OPTIONS,
  SCOPE_OPTIONS,
  SFX_OPTIONS,
  actionSpec,
  behaviorSpec,
  condSpec,
  type FieldDef,
} from "./spec";
import {
  KEY_OPTIONS,
  makeActorDef,
  makeBehavior,
  makeInstance,
  uid,
  type Action,
  type ActorDef,
  type Appearance,
  type Condition,
  type GameEvent,
  type MicrogameData,
} from "./schema";
import {
  decodeGame,
  deleteDataGame,
  duplicateDataGame,
  encodeGame,
  getDataGames,
  upsertDataGame,
} from "./library";

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

const defaultPixel = (): Extract<Appearance, { kind: "pixel" }> => ({
  kind: "pixel",
  grid: 12,
  palette: ["#ffffff", "#1a1a2e", "#e94560", "#ffd60a"],
  pixels: Array.from({ length: 12 }, () => new Array(12).fill(-1)),
});

const defaultsFrom = (fields: FieldDef[]) =>
  Object.fromEntries(fields.map((f) => [f.key, f.default]));

/* shared input styles */
const inp =
  "bg-black/30 border border-white/15 rounded px-2 py-1 text-sm text-white outline-none focus:border-fuchsia-400 w-full";
const lbl = "text-[11px] uppercase tracking-wide text-white/40 font-bold";

/* ================================================================== */
/*  Field input (renders the right control per param type)            */
/* ================================================================== */
const FieldInput: React.FC<{
  field: FieldDef;
  value: any;
  actors: ActorDef[];
  onChange: (v: any) => void;
}> = ({ field, value, actors, onChange }) => {
  const opts = (extra?: { value: string; label: string }[]) => {
    const list = [...(extra ?? [])];
    if (field.type === "key") list.push(...KEY_OPTIONS);
    if (field.type === "op") list.push(...OP_OPTIONS);
    if (field.type === "scope") list.push(...SCOPE_OPTIONS);
    if (field.type === "sfx") list.push(...SFX_OPTIONS);
    if (field.type === "pattern") list.push(...PATTERN_OPTIONS);
    if (field.type === "actor") list.push(...actors.map((a) => ({ value: a.id, label: a.name })));
    if (field.type === "other")
      list.push({ value: "any", label: "Any actor" }, ...actors.map((a) => ({ value: a.id, label: a.name })));
    return list;
  };

  if (field.type === "color")
    return (
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-9 h-8 rounded bg-transparent border border-white/15" />
    );
  if (field.type === "bool")
    return <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />;
  if (["key", "op", "scope", "sfx", "pattern", "actor", "other"].includes(field.type))
    return (
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={inp + " w-auto"}>
        {opts().map((o) => (
          <option key={o.value} value={o.value} className="bg-zinc-800">
            {o.label}
          </option>
        ))}
      </select>
    );
  return (
    <input
      value={value ?? ""}
      onChange={(e) => onChange(field.type === "number" ? Number(e.target.value) : e.target.value)}
      className={inp + " w-20"}
      placeholder={field.label}
    />
  );
};

/* ================================================================== */
/*  Editor                                                             */
/* ================================================================== */
export const Editor: React.FC<{ initial: MicrogameData; onClose: () => void }> = ({
  initial,
  onClose,
}) => {
  const [draft, setDraft] = useState<MicrogameData>(() => clone(initial));
  const [tab, setTab] = useState<"scene" | "sprite" | "events" | "settings">("scene");
  const [sel, setSel] = useState<{ type: "def" | "instance"; id: string } | null>(null);
  const [testing, setTesting] = useState(0); // >0 => testing; counter forces remount
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const mutate = (fn: (d: MicrogameData) => void) =>
    setDraft((prev) => {
      const c = clone(prev);
      fn(c);
      upsertDataGame(c);
      return c;
    });

  const actors = draft.actors;
  const selDef: ActorDef | null =
    sel?.type === "def"
      ? actors.find((a) => a.id === sel.id) ?? null
      : sel?.type === "instance"
        ? actors.find((a) => a.id === draft.scene.instances.find((i) => i.id === sel.id)?.defId) ?? null
        : null;
  const selInst = sel?.type === "instance" ? draft.scene.instances.find((i) => i.id === sel.id) ?? null : null;

  /* ---- actor def ops ---- */
  const addActor = () => {
    const a = makeActorDef("Actor " + (actors.length + 1), "👾");
    mutate((d) => {
      d.actors.push(a);
      d.scene.instances.push(makeInstance(a.id, 50, 40));
    });
    setSel({ type: "def", id: a.id });
  };
  const updateDef = (id: string, patch: Partial<ActorDef>) =>
    mutate((d) => {
      const a = d.actors.find((x) => x.id === id);
      if (a) Object.assign(a, patch);
    });
  const updateAppearance = (id: string, app: Appearance) =>
    mutate((d) => {
      const a = d.actors.find((x) => x.id === id);
      if (a) a.appearance = app;
    });
  const removeDef = (id: string) =>
    mutate((d) => {
      d.actors = d.actors.filter((a) => a.id !== id);
      d.scene.instances = d.scene.instances.filter((i) => i.defId !== id);
      d.events = d.events.map((e) => (e.forActor === id ? { ...e, forActor: null } : e));
    });

  /* ---- instance ops ---- */
  const addInstance = (defId: string) => {
    const inst = makeInstance(defId, 50, 40);
    mutate((d) => d.scene.instances.push(inst));
    setSel({ type: "instance", id: inst.id });
  };
  const updateInst = (id: string, patch: any) =>
    mutate((d) => {
      const i = d.scene.instances.find((x) => x.id === id);
      if (i) Object.assign(i, patch);
    });
  const removeInst = (id: string) =>
    mutate((d) => {
      d.scene.instances = d.scene.instances.filter((i) => i.id !== id);
    });

  /* ---- event ops ---- */
  const addEvent = () =>
    mutate((d) =>
      d.events.push({ id: uid("ev"), name: "Event " + (d.events.length + 1), forActor: null, enabled: true, conditions: [], actions: [] }),
    );
  const updateEvent = (id: string, patch: Partial<GameEvent>) =>
    mutate((d) => {
      const e = d.events.find((x) => x.id === id);
      if (e) Object.assign(e, patch);
    });
  const removeEvent = (id: string) => mutate((d) => (d.events = d.events.filter((e) => e.id !== id)));

  const addCond = (evId: string, kind: string) => {
    const spec = condSpec(kind);
    if (!spec) return;
    mutate((d) => {
      const e = d.events.find((x) => x.id === evId);
      if (e) e.conditions.push({ kind, params: defaultsFrom(spec.fields) });
    });
  };
  const updCond = (evId: string, idx: number, key: string, v: any) =>
    mutate((d) => {
      const e = d.events.find((x) => x.id === evId);
      if (e) e.conditions[idx].params[key] = v;
    });
  const delCond = (evId: string, idx: number) =>
    mutate((d) => {
      const e = d.events.find((x) => x.id === evId);
      if (e) e.conditions.splice(idx, 1);
    });

  const addAct = (evId: string, kind: string) => {
    const spec = actionSpec(kind);
    if (!spec) return;
    mutate((d) => {
      const e = d.events.find((x) => x.id === evId);
      if (e) e.actions.push({ kind, params: defaultsFrom(spec.fields), targetDef: null });
    });
  };
  const updAct = (evId: string, idx: number, key: string, v: any) =>
    mutate((d) => {
      const e = d.events.find((x) => x.id === evId);
      if (e) e.actions[idx].params[key] = v;
    });
  const updActTarget = (evId: string, idx: number, v: string | null) =>
    mutate((d) => {
      const e = d.events.find((x) => x.id === evId);
      if (e) e.actions[idx].targetDef = v || null;
    });
  const delAct = (evId: string, idx: number) =>
    mutate((d) => {
      const e = d.events.find((x) => x.id === evId);
      if (e) e.actions.splice(idx, 1);
    });

  return (
    <div className="fixed inset-0 z-[90] bg-zinc-950 text-white flex flex-col">
      {testing > 0 && <Tester key={testing} data={draft} onClose={() => setTesting(0)} />}

      {/* top bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border-b border-white/10 shrink-0">
        <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 font-bold text-sm">
          ◀ Save & Exit
        </button>
        <input
          value={draft.name}
          onChange={(e) => mutate((d) => (d.name = e.target.value))}
          className="bg-transparent font-black text-lg px-2 outline-none focus:bg-white/5 rounded w-48"
        />
        <div className="flex bg-black/30 rounded-lg p-0.5 ml-2">
          {(["scene", "sprite", "events", "settings"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-md text-sm font-bold capitalize ${
                tab === t ? "bg-fuchsia-600 text-white" : "text-white/60 hover:text-white"
              }`}
            >
              {t === "scene" ? "🗺️ Scene" : t === "sprite" ? "🎨 Sprite" : t === "events" ? "⚡ Events" : "⚙️ Settings"}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setShowImport(true)} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-bold">
            📥 Import
          </button>
          <button onClick={() => setShowExport(true)} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-bold">
            📤 Export
          </button>
          <button
            onClick={() => setTesting((n) => n + 1)}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold text-sm"
          >
            ▶ Test
          </button>
        </div>
      </div>

      {/* body */}
      <div className="flex-1 min-h-0 flex">
        {tab === "scene" && (
          <SceneTab
            draft={draft}
            sel={sel}
            setSel={setSel}
            selDef={selDef}
            selInst={selInst}
            addActor={addActor}
            updateDef={updateDef}
            removeDef={removeDef}
            addInstance={addInstance}
            updateInst={updateInst}
            removeInst={removeInst}
          />
        )}
        {tab === "sprite" && selDef && (
          <SpriteTab def={selDef} updateAppearance={(app) => updateAppearance(selDef.id, app)} />
        )}
        {tab === "sprite" && !selDef && <Empty msg="Select an actor to draw its sprite." />}
        {tab === "events" && (
          <EventsTab
            draft={draft}
            addEvent={addEvent}
            updateEvent={updateEvent}
            removeEvent={removeEvent}
            addCond={addCond}
            updCond={updCond}
            delCond={delCond}
            addAct={addAct}
            updAct={updAct}
            updActTarget={updActTarget}
            delAct={delAct}
          />
        )}
        {tab === "settings" && <SettingsTab draft={draft} mutate={mutate} />}
      </div>

      {showExport && <ExportModal data={draft} onClose={() => setShowExport(false)} />}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImport={(d) => {
            upsertDataGame(d);
            setDraft(clone(d));
            setSel(null);
            setShowImport(false);
          }}
        />
      )}
    </div>
  );
};

/* ================================================================== */
/*  Scene tab                                                          */
/* ================================================================== */
const SceneTab: React.FC<any> = ({
  draft, sel, setSel, selDef, selInst, addActor, updateDef, removeDef, addInstance, updateInst, removeInst,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<string | null>(null);

  const toScene = (e: React.PointerEvent | MouseEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)),
    };
  };

  const preview = (a: ActorDef) =>
    a.appearance.kind === "emoji" ? a.appearance.char : null;

  return (
    <>
      {/* left: actors */}
      <div className="w-48 shrink-0 border-r border-white/10 bg-zinc-900/50 p-2 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <span className={lbl}>Actors</span>
          <button onClick={addActor} className="text-xs px-2 py-0.5 rounded bg-fuchsia-600 font-bold">+ New</button>
        </div>
        <div className="flex flex-col gap-1">
          {draft.actors.map((a: ActorDef) => (
            <div
              key={a.id}
              className={`flex items-center gap-1 rounded px-1.5 py-1 cursor-pointer ${
                sel?.type === "def" && sel.id === a.id ? "bg-fuchsia-600/30 ring-1 ring-fuchsia-500" : "bg-white/5 hover:bg-white/10"
              }`}
              onClick={() => setSel({ type: "def", id: a.id })}
            >
              <span className="text-lg w-6 text-center">
                {preview(a) ?? <span className="inline-block w-4 h-4 rounded-sm align-middle" style={{ background: a.appearance.kind === "pixel" ? a.appearance.palette[0] : "#888" }} />}
              </span>
              <span className="text-sm flex-1 truncate">{a.name}</span>
              <button
                title="Place in scene"
                onClick={(e) => { e.stopPropagation(); addInstance(a.id); }}
                className="text-xs w-5 h-5 rounded bg-white/10 hover:bg-white/30"
              >
                +
              </button>
              <button
                title="Delete"
                onClick={(e) => { e.stopPropagation(); removeDef(a.id); }}
                className="text-xs w-5 h-5 rounded bg-white/10 hover:bg-red-500/60"
              >
                ✕
              </button>
            </div>
          ))}
          {draft.actors.length === 0 && <p className="text-white/30 text-xs">No actors yet.</p>}
        </div>
      </div>

      {/* center: canvas */}
      <div className="flex-1 min-w-0 flex items-center justify-center p-4 bg-[repeating-conic-gradient(#15151f_0%_25%,#1b1b27_0%_50%)] bg-[length:24px_24px]">
        <div
          ref={canvasRef}
          className="relative overflow-hidden rounded-lg shadow-2xl cursor-crosshair"
          style={{
            aspectRatio: "4 / 3",
            height: "100%",
            maxWidth: "100%",
            background: draft.scene.gradient
              ? `linear-gradient(to bottom, ${draft.scene.bgColor}, ${draft.scene.bg2Color})`
              : draft.scene.bgColor,
            containerType: "inline-size",
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const p = toScene(e);
            updateInst(drag.current, { x: p.x, y: p.y });
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerLeave={() => (drag.current = null)}
          onPointerDown={(e) => {
            // click empty area -> deselect
            if ((e.target as HTMLElement).dataset.bg) setSel(null);
          }}
        >
          {/* checker grid */}
          <div data-bg="1" className="absolute inset-0 opacity-[0.07]" style={{
            backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
            backgroundSize: "10% 10%",
          }} />
          {draft.scene.floorY < 100 && (
            <div data-bg="1" className="absolute left-0 right-0 bottom-0" style={{ height: `${100 - draft.scene.floorY}%`, background: draft.scene.groundColor }} />
          )}
          {draft.scene.instances.map((inst: any) => {
            const def = draft.actors.find((a: ActorDef) => a.id === inst.defId);
            if (!def) return null;
            const isSel = sel?.type === "instance" && sel.id === inst.id;
            return (
              <div
                key={inst.id}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  drag.current = inst.id;
                  setSel({ type: "instance", id: inst.id });
                  (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                }}
                className="absolute flex items-center justify-center"
                style={{
                  left: `${inst.x}%`, top: `${inst.y}%`, width: `${def.width}%`, height: `${def.height}%`,
                  transform: `translate(-50%,-50%) rotate(${inst.rot}deg) scale(${inst.scale})`,
                  outline: isSel ? "2px solid #e94560" : "1px dashed rgba(255,255,255,0.3)",
                  outlineOffset: 1, zIndex: def.z, cursor: "grab", touchAction: "none",
                  fontSize: `${def.height * 0.8}cqw`, lineHeight: 1,
                }}
              >
                {def.appearance.kind === "emoji" ? (
                  def.appearance.char
                ) : (
                  <div className="w-full h-full" style={{ background: def.appearance.palette[0], opacity: 0.8 }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* right: inspector */}
      <div className="w-64 shrink-0 border-l border-white/10 bg-zinc-900/50 p-3 overflow-y-auto">
        <Inspector
          draft={draft}
          selDef={selDef}
          selInst={selInst}
          updateDef={updateDef}
          updateInst={updateInst}
          removeInst={removeInst}
        />
      </div>
    </>
  );
};

/* ================================================================== */
/*  Inspector                                                          */
/* ================================================================== */
const Inspector: React.FC<any> = ({ selDef, selInst, updateDef, updateInst, removeInst }) => {
  if (selInst) {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="font-black text-fuchsia-400">INSTANCE</h3>
        <NumRow label="X" value={selInst.x} onChange={(v) => updateInst(selInst.id, { x: v })} />
        <NumRow label="Y" value={selInst.y} onChange={(v) => updateInst(selInst.id, { y: v })} />
        <NumRow label="Scale" value={selInst.scale} step={0.1} onChange={(v) => updateInst(selInst.id, { scale: v })} />
        <NumRow label="Rotation" value={selInst.rot} onChange={(v) => updateInst(selInst.id, { rot: v })} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={selInst.visible} onChange={(e) => updateInst(selInst.id, { visible: e.target.checked })} />
          Visible at start
        </label>
        <button onClick={() => removeInst(selInst.id)} className="px-3 py-1.5 rounded bg-red-600/70 hover:bg-red-500 text-sm font-bold">
          🗑️ Remove instance
        </button>
        <p className="text-white/30 text-xs">Tip: drag the actor in the canvas to move it.</p>
      </div>
    );
  }
  if (!selDef) return <p className="text-white/30 text-sm">Select an actor or instance to edit its properties.</p>;

  const beh = selDef.behavior;
  const bSpec = behaviorSpec(beh.type)!;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-black text-fuchsia-400">ACTOR</h3>
      <div>
        <div className={lbl}>Name</div>
        <input className={inp} value={selDef.name} onChange={(e) => updateDef(selDef.id, { name: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className={lbl}>Width</div>
          <input type="number" className={inp} value={selDef.width} onChange={(e) => updateDef(selDef.id, { width: Number(e.target.value) })} />
        </div>
        <div>
          <div className={lbl}>Height</div>
          <input type="number" className={inp} value={selDef.height} onChange={(e) => updateDef(selDef.id, { height: Number(e.target.value) })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className={lbl}>Z order</div>
          <input type="number" className={inp} value={selDef.z} onChange={(e) => updateDef(selDef.id, { z: Number(e.target.value) })} />
        </div>
        <label className="flex items-end gap-2 text-sm pb-1">
          <input type="checkbox" checked={selDef.solid} onChange={(e) => updateDef(selDef.id, { solid: e.target.checked })} />
          Solid
        </label>
      </div>

      <hr className="border-white/10" />
      <div className={lbl}>Behavior</div>
      <div className="flex flex-wrap gap-1">
        {BEHAVIOR_SPECS.map((b) => (
          <button
            key={b.id}
            onClick={() => updateDef(selDef.id, { behavior: mergeBehavior(beh.type, b.id, beh) })}
            className={`px-2 py-1 rounded text-xs font-bold ${
              beh.type === b.id ? "bg-fuchsia-600 text-white" : "bg-white/10 text-white/60"
            }`}
          >
            {b.icon} {b.label}
          </button>
        ))}
      </div>
      {bSpec.fields.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {bSpec.fields.map((f: FieldDef) => (
            <div key={f.key}>
              <div className={lbl}>{f.label}</div>
              <input
                type="number"
                step={f.key === "bounce" || f.key === "friction" ? 0.1 : 1}
                className={inp}
                value={(beh as any)[f.key]}
                onChange={(e) => updateDef(selDef.id, { behavior: { ...beh, [f.key]: Number(e.target.value) } })}
              />
            </div>
          ))}
        </div>
      )}
      <p className="text-white/30 text-xs">
        Platformer/8-Dir/Physics respond to Arrow keys + Space. Drag &amp; Drop uses the mouse.
      </p>
    </div>
  );
};

const mergeBehavior = (prev: string, next: string, beh: any) => {
  if (prev === next) return beh;
  const fresh = makeBehavior(next as any);
  return fresh;
};

const NumRow: React.FC<{ label: string; value: number; step?: number; onChange: (v: number) => void }> = ({
  label, value, step = 1, onChange,
}) => (
  <div className="flex items-center gap-2">
    <span className="text-xs text-white/50 w-14">{label}</span>
    <input type="number" step={step} className={inp} value={value} onChange={(e) => onChange(Number(e.target.value))} />
  </div>
);

/* ================================================================== */
/*  Sprite tab                                                         */
/* ================================================================== */
const SpriteTab: React.FC<{ def: ActorDef; updateAppearance: (a: Appearance) => void }> = ({
  def, updateAppearance,
}) => {
  const app = def.appearance;
  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center gap-4">
      <div className="flex gap-2">
        <button
          onClick={() => updateAppearance({ kind: "emoji", char: app.kind === "emoji" ? app.char : "⭐" })}
          className={`px-3 py-1.5 rounded font-bold text-sm ${app.kind === "emoji" ? "bg-fuchsia-600" : "bg-white/10"}`}
        >
          😀 Emoji
        </button>
        <button
          onClick={() => updateAppearance(app.kind === "pixel" ? app : defaultPixel())}
          className={`px-3 py-1.5 rounded font-bold text-sm ${app.kind === "pixel" ? "bg-fuchsia-600" : "bg-white/10"}`}
        >
          🎨 Draw Pixel Art
        </button>
      </div>

      {app.kind === "emoji" ? (
        <div className="flex flex-col items-center gap-3">
          <div className="bg-white/5 rounded-xl p-8 text-[80px] leading-none">{app.char}</div>
          <input
            value={app.char}
            onChange={(e) => updateAppearance({ kind: "emoji", char: e.target.value.slice(0, 2) })}
            className={inp + " text-center text-2xl w-32"}
            placeholder="😎"
          />
          <div className="flex flex-wrap gap-1 max-w-xs justify-center">
            {"😀🐰🚀⚽🍎🪙👾🤖🐱🦊⭐❤️💥🔥🧺📦🏁⚡🛸☄️🥚💎🍭".split("").map((c, i) => (
              <button key={i} onClick={() => updateAppearance({ kind: "emoji", char: c })} className="text-2xl hover:scale-125 transition">
                {c}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <PixelEditor value={app} onChange={updateAppearance} />
      )}
    </div>
  );
};

/* ================================================================== */
/*  Events tab                                                         */
/* ================================================================== */
const EventsTab: React.FC<any> = ({
  draft, addEvent, updateEvent, removeEvent, addCond, updCond, delCond, addAct, updAct, updActTarget, delAct,
}) => {
  const groups = useMemo(() => {
    const g: Record<string, typeof COND_SPECS> = {};
    COND_SPECS.forEach((c) => (g[c.category] ??= []).push(c));
    return g;
  }, []);
  const agroups = useMemo(() => {
    const g: Record<string, typeof ACTION_SPECS> = {};
    ACTION_SPECS.forEach((c) => (g[c.category] ??= []).push(c));
    return g;
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-4xl mx-auto flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-black text-lg">⚡ Event Sheet</h2>
          <button onClick={addEvent} className="px-3 py-1.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 font-bold text-sm">
            + Add Event
          </button>
        </div>
        <p className="text-white/40 text-xs">
          When <b>conditions</b> are true → run <b>actions</b>. Pick an actor to iterate as "self", or leave it
          scene-level. Values can be numbers or tokens like <code>{"{scene:t}"}</code>, <code>{"{self:x}"}</code>, <code>{"{rnd:1,9}"}</code>.
        </p>

        {draft.events.map((ev: GameEvent) => (
          <div key={ev.id} className="rounded-xl border border-white/10 bg-zinc-900/60 overflow-hidden">
            {/* header */}
            <div className="flex items-center gap-2 px-3 py-2 bg-black/30">
              <input type="checkbox" checked={ev.enabled} onChange={(e) => updateEvent(ev.id, { enabled: e.target.checked })} />
              <span className="text-xs text-white/40">IF</span>
              <select
                value={ev.forActor ?? ""}
                onChange={(e) => updateEvent(ev.id, { forActor: e.target.value || null })}
                className={inp + " w-auto"}
              >
                <option value="" className="bg-zinc-800">— Scene (no actor) —</option>
                {draft.actors.map((a: ActorDef) => (
                  <option key={a.id} value={a.id} className="bg-zinc-800">{a.name}</option>
                ))}
              </select>
              <span className="text-xs text-white/40">then…</span>
              <button onClick={() => removeEvent(ev.id)} className="ml-auto text-xs px-2 py-1 rounded bg-red-600/60 hover:bg-red-500 font-bold">
                ✕ Delete
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-2 p-3">
              {/* conditions */}
              <div>
                <div className={lbl + " mb-1"}>Conditions (all must be true)</div>
                <div className="flex flex-col gap-1">
                  {ev.conditions.map((c: Condition, ci: number) => {
                    const spec = condSpec(c.kind)!;
                    return (
                      <div key={ci} className="flex items-center gap-1 flex-wrap bg-white/5 rounded px-2 py-1">
                        <span className="text-xs font-bold text-sky-300">{spec.label}</span>
                        {spec.fields.map((f) => (
                          <FieldInput key={f.key} field={f} actors={draft.actors} value={c.params[f.key]} onChange={(v) => updCond(ev.id, ci, f.key, v)} />
                        ))}
                        <button onClick={() => delCond(ev.id, ci)} className="ml-auto text-xs text-white/40 hover:text-red-400">✕</button>
                      </div>
                    );
                  })}
                  <Adder label="+ condition" groups={groups} onPick={(k) => addCond(ev.id, k)} />
                </div>
              </div>

              {/* actions */}
              <div>
                <div className={lbl + " mb-1"}>Actions</div>
                <div className="flex flex-col gap-1">
                  {ev.actions.map((a: Action, ai: number) => {
                    const spec = actionSpec(a.kind)!;
                    return (
                      <div key={ai} className="flex items-center gap-1 flex-wrap bg-white/5 rounded px-2 py-1">
                        <span className="text-xs font-bold text-emerald-300">{spec.label}</span>
                        {spec.fields.map((f) => (
                          <FieldInput key={f.key} field={f} actors={draft.actors} value={a.params[f.key]} onChange={(v) => updAct(ev.id, ai, f.key, v)} />
                        ))}
                        {!spec.sceneLevel && (
                          <select
                            value={a.targetDef ?? ""}
                            onChange={(e) => updActTarget(ev.id, ai, e.target.value)}
                            className={inp + " w-auto"}
                            title="Apply to"
                          >
                            <option value="" className="bg-zinc-800">→ self</option>
                            {draft.actors.map((ax: ActorDef) => (
                              <option key={ax.id} value={ax.id} className="bg-zinc-800">→ all {ax.name}</option>
                            ))}
                          </select>
                        )}
                        <button onClick={() => delAct(ev.id, ai)} className="ml-auto text-xs text-white/40 hover:text-red-400">✕</button>
                      </div>
                    );
                  })}
                  <Adder label="+ action" groups={agroups} onPick={(k) => addAct(ev.id, k)} />
                </div>
              </div>
            </div>
          </div>
        ))}
        {draft.events.length === 0 && (
          <div className="text-center text-white/30 py-12 border-2 border-dashed border-white/10 rounded-xl">
            No events yet. Add one to give your microgame rules!
          </div>
        )}
      </div>
    </div>
  );
};

const Adder: React.FC<{ label: string; groups: Record<string, any[]>; onPick: (kind: string) => void }> = ({
  label, groups, onPick,
}) => (
  <select
    value=""
    onChange={(e) => { if (e.target.value) onPick(e.target.value); e.target.value = ""; }}
    className={inp + " w-auto text-xs"}
  >
    <option value="" className="bg-zinc-800">{label}</option>
    {Object.entries(groups).map(([cat, items]) => (
      <optgroup key={cat} label={cat} className="bg-zinc-800">
        {items.map((s: any) => (
          <option key={s.id} value={s.id} className="bg-zinc-800">{s.label}</option>
        ))}
      </optgroup>
    ))}
  </select>
);

/* ================================================================== */
/*  Settings tab                                                       */
/* ================================================================== */
const SettingsTab: React.FC<{ draft: MicrogameData; mutate: (fn: (d: MicrogameData) => void) => void }> = ({
  draft, mutate,
}) => (
  <div className="flex-1 overflow-y-auto p-6">
    <div className="max-w-xl mx-auto flex flex-col gap-4">
      <h2 className="font-black text-lg">⚙️ Game Settings</h2>

      <div>
        <div className={lbl}>Instruction (shown on the beat)</div>
        <input className={inp} value={draft.instruction} onChange={(e) => mutate((d) => (d.instruction = e.target.value))} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className={lbl}>Length</div>
          <select value={draft.lengthBars} onChange={(e) => mutate((d) => (d.lengthBars = Number(e.target.value) as 2 | 4))} className={inp}>
            <option value={2} className="bg-zinc-800">2 bars</option>
            <option value={4} className="bg-zinc-800">4 bars (framerules)</option>
          </select>
        </div>
        <div>
          <div className={lbl}>On timeout</div>
          <select value={draft.timeoutOutcome} onChange={(e) => mutate((d) => (d.timeoutOutcome = e.target.value as any))} className={inp}>
            <option value="lose" className="bg-zinc-800">Lose</option>
            <option value="win" className="bg-zinc-800">Win (survive)</option>
          </select>
        </div>
        <div>
          <div className={lbl}>Test BPM</div>
          <input type="number" className={inp} value={draft.bpm ?? 124} onChange={(e) => mutate((d) => (d.bpm = Number(e.target.value)))} />
        </div>
      </div>

      <hr className="border-white/10" />
      <div className={lbl}>Palette (console colors)</div>
      <div className="grid grid-cols-4 gap-3">
        {(["outer", "frame", "screen", "text"] as const).map((k) => (
          <label key={k} className="flex flex-col gap-1">
            <span className="text-xs text-white/50 capitalize">{k}</span>
            <input type="color" value={(draft.palette as any)[k]} onChange={(e) => mutate((d) => ((d.palette as any)[k] = e.target.value))} className="h-9 rounded bg-transparent border border-white/15" />
          </label>
        ))}
      </div>

      <hr className="border-white/10" />
      <div className={lbl}>Backdrop</div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-white/50">Top color</span>
          <input type="color" value={draft.scene.bgColor} onChange={(e) => mutate((d) => (d.scene.bgColor = e.target.value))} className="h-9 rounded bg-transparent border border-white/15" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-white/50">Bottom color</span>
          <input type="color" value={draft.scene.bg2Color} onChange={(e) => mutate((d) => (d.scene.bg2Color = e.target.value))} className="h-9 rounded bg-transparent border border-white/15" />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={draft.scene.gradient} onChange={(e) => mutate((d) => (d.scene.gradient = e.target.checked))} />
        Vertical gradient
      </label>
      <div className="flex items-center gap-2">
        <span className="text-xs text-white/50 w-16">Pattern</span>
        <select value={draft.scene.pattern} onChange={(e) => mutate((d) => (d.scene.pattern = e.target.value as any))} className={inp + " w-auto"}>
          {PATTERN_OPTIONS.map((o) => <option key={o.value} value={o.value} className="bg-zinc-800">{o.label}</option>)}
        </select>
      </div>

      <div className={lbl}>Floor / Ground</div>
      <div className="grid grid-cols-2 gap-3 items-end">
        <div>
          <span className="text-xs text-white/50">Floor Y (100 = none)</span>
          <input type="number" className={inp} value={draft.scene.floorY} onChange={(e) => mutate((d) => (d.scene.floorY = Number(e.target.value)))} />
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-white/50">Ground color</span>
          <input type="color" value={draft.scene.groundColor} onChange={(e) => mutate((d) => (d.scene.groundColor = e.target.value))} className="h-9 rounded bg-transparent border border-white/15" />
        </label>
      </div>
    </div>
  </div>
);

const Empty: React.FC<{ msg: string }> = ({ msg }) => (
  <div className="flex-1 flex items-center justify-center text-white/40">{msg}</div>
);

/* ================================================================== */
/*  Export / Import modals                                             */
/* ================================================================== */
const ExportModal: React.FC<{ data: MicrogameData; onClose: () => void }> = ({ data, onClose }) => {
  const code = useMemo(() => encodeGame(data), [data]);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => setCopied(true));
  };
  return (
    <Modal title="📤 Export microgame" onClose={onClose}>
      <p className="text-white/50 text-sm mb-2">Copy this share code or download the JSON. Anyone can paste it into Import.</p>
      <textarea readOnly value={code} className="w-full h-40 bg-black/40 border border-white/15 rounded p-2 text-xs text-emerald-300 font-mono" />
      <div className="flex gap-2 mt-3">
        <button onClick={copy} className="px-3 py-1.5 rounded bg-fuchsia-600 font-bold text-sm">
          {copied ? "✓ Copied!" : "Copy code"}
        </button>
        <a
          href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`}
          download={`${data.name || "microgame"}.json`}
          className="px-3 py-1.5 rounded bg-white/10 font-bold text-sm flex items-center"
        >
          ⬇ Download .json
        </a>
      </div>
    </Modal>
  );
};

const ImportModal: React.FC<{ onClose: () => void; onImport: (d: MicrogameData) => void }> = ({ onClose, onImport }) => {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const go = () => {
    const d = decodeGame(text);
    if (!d) { setErr("Couldn't parse that. Paste a valid share code or JSON."); return; }
    onImport(d);
  };
  return (
    <Modal title="📥 Import microgame" onClose={onClose}>
      <p className="text-white/50 text-sm mb-2">Paste a share code (MM1:…) or raw JSON below.</p>
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setErr(""); }}
        placeholder="MM1:...  or  { &quot;name&quot;: ... }"
        className="w-full h-40 bg-black/40 border border-white/15 rounded p-2 text-xs text-emerald-300 font-mono"
      />
      {err && <p className="text-red-400 text-xs mt-1">{err}</p>}
      <button onClick={go} className="px-3 py-1.5 rounded bg-emerald-600 font-bold text-sm mt-3">Load into editor</button>
    </Modal>
  );
};

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-[110] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-zinc-900 border border-white/15 rounded-2xl p-5 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-black text-lg">{title}</h3>
        <button onClick={onClose} className="text-white/50 hover:text-white">✕</button>
      </div>
      {children}
    </div>
  </div>
);

/* ================================================================== */
/*  Library modal (browse / play-test / edit / export / delete)       */
/* ================================================================== */
export const LibraryModal: React.FC<{
  onClose: () => void;
  onEdit: (d: MicrogameData) => void;
}> = ({ onClose, onEdit }) => {
  const [, force] = useState(0);
  const refresh = () => force((n) => n + 1);
  const games = getDataGames();
  const [imp, setImp] = useState(false);

  return (
    <div className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-white/15 rounded-2xl p-5 w-full max-w-3xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-xl">📚 Microgame Library</h3>
          <div className="flex gap-2">
            <button onClick={() => setImp(true)} className="px-3 py-1.5 rounded bg-white/10 font-bold text-sm">📥 Import</button>
            <button onClick={onClose} className="text-white/50 hover:text-white text-xl">✕</button>
          </div>
        </div>
        <p className="text-white/40 text-xs mb-4">
          These appear in the random game rotation. Saved games persist in your browser.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {games.map((g) => (
            <div key={g.id} className="rounded-xl border border-white/10 bg-zinc-800/60 p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-md flex items-center justify-center text-lg" style={{ background: g.palette.screen }}>
                  {g.actors[0]?.appearance.kind === "emoji" ? g.actors[0].appearance.char : "🎨"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{g.name}</div>
                  <div className="text-white/40 text-xs truncate">{g.instruction} · {g.lengthBars} bars</div>
                </div>
              </div>
              <div className="flex gap-1 flex-wrap">
                <button onClick={() => onEdit(clone(g))} className="px-2 py-1 rounded bg-fuchsia-600 text-xs font-bold">✎ Edit</button>
                <button onClick={() => { duplicateDataGame(g.id); refresh(); }} className="px-2 py-1 rounded bg-white/10 text-xs font-bold">⧉ Dup</button>
                <button onClick={() => { navigator.clipboard?.writeText(encodeGame(g)); }} className="px-2 py-1 rounded bg-white/10 text-xs font-bold" title="Copy share code">📤</button>
                <button onClick={() => { if (confirm(`Delete "${g.name}"?`)) { deleteDataGame(g.id); refresh(); } }} className="px-2 py-1 rounded bg-red-600/60 text-xs font-bold ml-auto">🗑️</button>
              </div>
            </div>
          ))}
        </div>
        {imp && (
          <ImportModal
            onClose={() => setImp(false)}
            onImport={(d) => { upsertDataGame(d); setImp(false); refresh(); }}
          />
        )}
      </div>
    </div>
  );
};
