/* ==================================================================
 *  Costume Studio — the rebuilt art & animation tab.
 *
 *  Replaces v1's Sprite tab, which edited ONE static appearance per actor
 *  and offered paint / fill / erase on a single grid.
 *
 *  What the brief asked for, and where it landed:
 *
 *   - "Actors need costumes, each with its own animated sprite sequence"
 *          -> costume rail (left), frame strip (bottom), live preview
 *   - "eraser effects, pattern-drawing tools"
 *          -> see PixelEditor: dither/checker/noise patterns, shaped
 *             erasers, mirror drawing, onion skin
 *   - "interruptible animations"
 *          -> playback modes + the runtime's animInterrupted flag, which
 *             the event sheet can read via {self:interrupted}
 *   - "resolution flexible, NOT a forced pixel-vs-photoreal toggle"
 *          -> grid size is a quiet stepper on the canvas; fidelity is
 *             derived from canvas size. No modal ever asks the question.
 *
 *  Tone: this is meant to feel like Mario Paint, so the controls are big,
 *  immediate, and reversible, and everything previews live at tempo.
 * ================================================================== */

import React, { useEffect, useRef, useState } from "react";
import { PixelEditor, defaultPixel } from "./PixelEditor";
import { Sprite } from "../engine/Sprite";
import {
  makeCostume,
  uid,
  type ActorDef,
  type Appearance,
  type Costume,
  type Playback,
} from "./schema";

const lbl = "text-[10px] uppercase tracking-wider text-white/40 font-bold";
const inp =
  "bg-black/40 border border-white/15 rounded px-2 py-1 text-sm outline-none focus:border-fuchsia-500";

const PLAYBACKS: { v: Playback; label: string; hint: string }[] = [
  { v: "loop", label: "Loop", hint: "restart forever" },
  { v: "pingpong", label: "Ping-pong", hint: "forward then back" },
  { v: "once", label: "Once", hint: "stop on last frame" },
  { v: "onceHide", label: "Once + hide", hint: "vanish at the end" },
];

const EMOJI_TRAY =
  "😀😃😄😁😆😅😂🙂😉😊😍🤩😎🤔😐😑😶🙄😏😣😥😮😯😪😫😴😌😛😜🤪😝🤤😒😓😔😕🙃🤑😲🙁😖😞😟😤😢😭😦😧😨😩🤯😬😰😱🥵🥶😳🤗🤭🤫😵🤐🥴🤢🤮🤧😷🤒🤕👾🤖🎃😺🐰🐱🐶🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🙈🙉🙊🐔🐧🐦🐤🦆🦅🦉🦇🐺🐗🐴🦄🐝🐛🦋🐌🐞🐜🦗🕷️🦂🐢🐍🦎🦖🦕🐙🦑🦐🦞🦀🐡🐠🐟🐬🐳🐋🦈🐊🐅🐆🦓🦍🐘🦛🦏🐪🐫🦒🦘🐃🐂🐄🐎🐖🐏🐑🦙🐐🦌🐕🐩🦮🐈🐓🦃🦚🦜🦢🦩🕊️🐇🦝🦨🦡🦦🦥🐁🐀🐿️🦔⚽🏀🏈⚾🥎🎾🏐🏉🥏🎱🪀🏓🏸🥅⛳🪁🏹🎣🤿🥊🥋🎽🛹🛼🛷⛸️🥌🎿⛷️🏂🪂🏋️🤼🤸🤺🤾🏌️🏇🧘🏄🏊🤽🚣🧗🚴🚵🎪🎭🎨🎬🎤🎧🎼🎹🥁🎷🎺🎸🪕🎻🎲♟️🎯🎳🎮🎰🧩🚗🚕🚙🚌🚎🏎️🚓🚑🚒🚐🛻🚚🚛🚜🦯🦽🦼🛴🚲🛵🏍️🛺🚨🚔🚍🚘🚖🚡🚠🚟🚃🚋🚞🚝🚄🚅🚈🚂🚆🚇🚊🚉✈️🛫🛬🛩️💺🛰️🚀🛸🚁🛶⛵🚤🛥️🛳️⛴️🚢⚓🪝⛽🚧🚦🚥🗺️🗿🗽🗼🏰🏯🏟️🎡🎢🎠⛲⛱️🏖️🏝️🏜️🌋⛰️🏔️🗻🏕️⛺🛖🏠🏡🏘️🏚️🏗️🏭🏢🏬🏣🏤🏥🏦🏨🏪🏫🏩💒🏛️⛪🕌🕍🛕🕋⛩️🛤️🛣️🗾🎑🏞️🌅🌄🌠🎇🎆🌇🌆🏙️🌃🌌🌉🌁⌚📱💻⌨️🖥️🖨️🖱️💽💾💿📀📼📷📸📹🎥📽️🎞️📞☎️📟📠📺📻🎙️🎚️🎛️🧭⏱️⏲️⏰🕰️⌛⏳📡🔋🔌💡🔦🕯️🪔🧯🛢️💸💵💴💶💷🪙💰💳💎⚖️🪜🧰🪛🔧🔨⚒️🛠️⛏️🪓🪚🔩⚙️🪤🧱⛓️🧲🔫💣🧨🪃🔪🗡️⚔️🛡️🚬⚰️🪦⚱️🏺🔮📿🧿💈⚗️🔭🔬🕳️🩹🩺💊💉🩸🧬🦠🧫🧪🌡️🧹🪠🧺🧻🚽🚰🚿🛁🛀🧼🪥🪒🧽🪣🧴🛎️🔑🗝️🚪🪑🛋️🛏️🛌🧸🪆🖼️🪞🪟🛍️🛒🎁🎈🎏🎀🪄🪅🎊🎉🎎🏮🎐🧧✉️📩📨📧💌📥📤📦🏷️🪧📪📫📬📭📮📯📜📃📄📑🧾📊📈📉🗒️🗓️📆📅🗑️📇🗃️🗳️🗄️📋📁📂🗂️🗞️📰📓📔📒📕📗📘📙📚📖🔖🧷🔗📎🖇️📐📏🧮📌📍✂️🖊️🖋️✒️🖌️🖍️📝✏️🔍🔎🔏🔐🔒🔓❤️🧡💛💚💙💜🖤🤍🤎💔❣️💕💞💓💗💖💘💝💟☮️✝️☪️🕉️☸️✡️🔯🕎☯️☦️🛐⛎♈♉♊♋♌♍♎♏♐♑♒♓🆔⚛️🉑☢️☣️📴📳🈶🈚🈸🈺🈷️✴️🆚💮🉐㊙️㊗️🈴🈵🈹🈲🅰️🅱️🆎🆑🅾️🆘❌⭕🛑⛔📛🚫💯💢♨️🚷🚯🚳🚱🔞📵🚭❗❕❓❔‼️⁉️🔅🔆〽️⚠️🚸🔱⚜️🔰♻️✅🈯💹❇️✳️❎🌐💠Ⓜ️🌀💤🏧🚾♿🅿️🛗🈳🈂️🛂🛃🛄🛅🚹🚺🚼⚧🚻🚮🎦📶🈁🔣ℹ️🔤🔡🔠🆖🆗🆙🆒🆕🆓⭐🌟✨⚡🔥💥☄️🌈☀️🌤️⛅🌥️☁️🌦️🌧️⛈️🌩️🌨️❄️☃️⛄🌬️💨🌪️🌫️🌊💧💦☔☂️🌂";

/* ---- costume rail ------------------------------------------------- */
const CostumeChip: React.FC<{
  c: Costume;
  active: boolean;
  isDefault: boolean;
  onPick: () => void;
  onRename: (n: string) => void;
  onDelete: () => void;
  onMakeDefault: () => void;
}> = ({ c, active, isDefault, onPick, onRename, onDelete, onMakeDefault }) => {
  const [editing, setEditing] = useState(false);
  return (
    <div
      onClick={onPick}
      className={`group relative rounded-lg p-1.5 cursor-pointer border ${
        active ? "bg-fuchsia-600/25 border-fuchsia-500" : "bg-white/5 border-white/10 hover:bg-white/10"
      }`}
    >
      <div className="w-full aspect-square rounded bg-black/40 flex items-center justify-center overflow-hidden">
        <div style={{ width: "80%", height: "80%", containerType: "inline-size" }}>
          <Sprite app={c.frames[0]?.app ?? null} sizeCqw={70} />
        </div>
      </div>

      {editing ? (
        <input
          autoFocus
          defaultValue={c.name}
          onBlur={(e) => { onRename(e.target.value.trim() || c.name); setEditing(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 w-full bg-black/60 border border-fuchsia-500 rounded px-1 text-[11px] outline-none"
        />
      ) : (
        <div
          className="mt-1 text-[11px] text-center truncate font-bold"
          onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
          title="Double-click to rename"
        >
          {c.name}
        </div>
      )}

      <div className="text-[9px] text-center text-white/35">
        {c.frames.length} {c.frames.length === 1 ? "cel" : "cels"}
      </div>

      {isDefault && (
        <div
          className="absolute top-0.5 left-0.5 text-[8px] px-1 rounded bg-amber-400 text-black font-black"
          title="Actors spawn wearing this costume"
        >
          START
        </div>
      )}

      <div className="absolute top-0.5 right-0.5 hidden group-hover:flex gap-0.5">
        {!isDefault && (
          <button
            onClick={(e) => { e.stopPropagation(); onMakeDefault(); }}
            title="Make this the starting costume"
            className="text-[9px] w-4 h-4 rounded bg-amber-500/80 hover:bg-amber-400 text-black font-black"
          >
            ★
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete costume"
          className="text-[9px] w-4 h-4 rounded bg-rose-600/80 hover:bg-rose-500 font-black"
        >
          ×
        </button>
      </div>
    </div>
  );
};

/* ---- the studio --------------------------------------------------- */
export const CostumeStudio: React.FC<{
  def: ActorDef;
  update: (patch: Partial<ActorDef>) => void;
}> = ({ def, update }) => {
  const costumes = def.costumes ?? [];
  const [ci, setCi] = useState(0);
  const [fi, setFi] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [onion, setOnion] = useState(false);

  const costume = costumes[Math.min(ci, costumes.length - 1)];
  const frame = costume?.frames[Math.min(fi, (costume?.frames.length ?? 1) - 1)];

  /* live preview clock — runs at the microgame's own tempo so what you see
     here is what you get in play, not an arbitrary editor framerate */
  const [previewFrame, setPreviewFrame] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (!playing || !costume || costume.frames.length < 2) return;
    let last = performance.now();
    let clock = 0;
    let idx = 0;
    let dir = 1;
    const BPM = 124;
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      clock += (dt * BPM) / 60;
      const hold = Math.max(0.01, costume.frames[idx]?.hold ?? 0.25);
      if (clock >= hold) {
        clock -= hold;
        if (costume.playback === "pingpong") {
          if (idx + dir >= costume.frames.length || idx + dir < 0) dir *= -1;
          idx += dir;
        } else if (costume.playback === "loop") {
          idx = (idx + 1) % costume.frames.length;
        } else if (idx < costume.frames.length - 1) {
          idx++;
        }
        setPreviewFrame(idx);
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, costume]);

  if (!costume) return <div className="flex-1 grid place-items-center text-white/40">No costumes.</div>;

  /* ---- mutators ---- */
  const writeCostumes = (next: Costume[]) => update({ costumes: next });
  const patchCostume = (patch: Partial<Costume>) =>
    writeCostumes(costumes.map((c, i) => (i === ci ? { ...c, ...patch } : c)));
  const patchFrame = (app: Appearance) =>
    patchCostume({
      frames: costume.frames.map((f, i) => (i === fi ? { ...f, app } : f)),
    });
  const patchHold = (hold: number) =>
    patchCostume({ frames: costume.frames.map((f, i) => (i === fi ? { ...f, hold } : f)) });

  const addCostume = () => {
    const name = `costume${costumes.length + 1}`;
    writeCostumes([...costumes, makeCostume(name, { kind: "emoji", char: "⭐" })]);
    setCi(costumes.length);
    setFi(0);
  };
  const dupCostume = () => {
    const copy: Costume = {
      ...costume,
      id: uid("cos"),
      name: `${costume.name} copy`,
      frames: costume.frames.map((f) => ({ ...f })),
    };
    writeCostumes([...costumes, copy]);
    setCi(costumes.length);
  };
  const delCostume = (i: number) => {
    if (costumes.length <= 1) return;
    const gone = costumes[i];
    const next = costumes.filter((_, k) => k !== i);
    const patch: Partial<ActorDef> = { costumes: next };
    if (def.defaultCostume === gone.name) patch.defaultCostume = next[0].name;
    update(patch);
    setCi(Math.max(0, i - 1));
    setFi(0);
  };
  const renameCostume = (i: number, name: string) => {
    const was = costumes[i].name;
    const patch: Partial<ActorDef> = {
      costumes: costumes.map((c, k) => (k === i ? { ...c, name } : c)),
    };
    if (def.defaultCostume === was) patch.defaultCostume = name;
    update(patch);
  };

  const addFrame = () => {
    const src = costume.frames[fi] ?? costume.frames[0];
    const frames = [...costume.frames];
    frames.splice(fi + 1, 0, { app: JSON.parse(JSON.stringify(src.app)), hold: src.hold });
    patchCostume({ frames });
    setFi(fi + 1);
  };
  const delFrame = () => {
    if (costume.frames.length <= 1) return;
    patchCostume({ frames: costume.frames.filter((_, i) => i !== fi) });
    setFi(Math.max(0, fi - 1));
  };
  const moveFrame = (dir: -1 | 1) => {
    const j = fi + dir;
    if (j < 0 || j >= costume.frames.length) return;
    const frames = [...costume.frames];
    [frames[fi], frames[j]] = [frames[j], frames[fi]];
    patchCostume({ frames });
    setFi(j);
  };

  const app = frame?.app ?? { kind: "emoji", char: "⭐" };
  const onionApp = onion && fi > 0 ? costume.frames[fi - 1]?.app : null;

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* ---- costume rail ---- */}
      <div className="w-32 shrink-0 border-r border-white/10 bg-zinc-900/60 p-2 overflow-y-auto">
        <div className={lbl + " mb-1"}>Costumes</div>
        <div className="flex flex-col gap-1.5">
          {costumes.map((c, i) => (
            <CostumeChip
              key={c.id}
              c={c}
              active={i === ci}
              isDefault={def.defaultCostume === c.name}
              onPick={() => { setCi(i); setFi(0); }}
              onRename={(n) => renameCostume(i, n)}
              onDelete={() => delCostume(i)}
              onMakeDefault={() => update({ defaultCostume: c.name })}
            />
          ))}
        </div>
        <button
          onClick={addCostume}
          className="mt-2 w-full text-xs py-1 rounded bg-fuchsia-600 hover:bg-fuchsia-500 font-bold"
        >
          + Costume
        </button>
        <button
          onClick={dupCostume}
          className="mt-1 w-full text-[11px] py-1 rounded bg-white/10 hover:bg-white/20 font-bold"
        >
          ⧉ Duplicate
        </button>
        <p className="mt-2 text-[9px] leading-tight text-white/30">
          Switch these from the event sheet with <b className="text-white/50">Switch costume</b>.
        </p>
      </div>

      {/* ---- canvas + frame strip ---- */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* toolbar */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/10 bg-zinc-900/40 text-xs">
          <span className={lbl}>Kind</span>
          {(
            [
              ["emoji", "😀 Emoji"],
              ["pixel", "🎨 Pixels"],
              ["shape", "⬛ Shape"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() =>
                patchFrame(
                  k === "emoji"
                    ? { kind: "emoji", char: app.kind === "emoji" ? app.char : "⭐" }
                    : k === "pixel"
                      ? app.kind === "pixel" ? app : defaultPixel()
                      : { kind: "shape", shape: "rect", fill: "#f72585" },
                )
              }
              className={`px-2 py-1 rounded font-bold ${app.kind === k ? "bg-fuchsia-600" : "bg-white/10 hover:bg-white/20"}`}
            >
              {label}
            </button>
          ))}

          <div className="w-px h-5 bg-white/10 mx-1" />

          <span className={lbl}>Playback</span>
          <select
            value={costume.playback}
            onChange={(e) => patchCostume({ playback: e.target.value as Playback })}
            className={inp + " text-xs"}
          >
            {PLAYBACKS.map((p) => (
              <option key={p.v} value={p.v} className="bg-zinc-800">
                {p.label} — {p.hint}
              </option>
            ))}
          </select>

          <div className="flex-1" />

          <label className="flex items-center gap-1 cursor-pointer" title="Show the previous cel faintly behind this one">
            <input type="checkbox" checked={onion} onChange={(e) => setOnion(e.target.checked)} />
            <span className="text-white/60">Onion skin</span>
          </label>
          <button
            onClick={() => setPlaying((p) => !p)}
            className={`px-2 py-1 rounded font-bold ${playing ? "bg-emerald-600" : "bg-white/10"}`}
          >
            {playing ? "⏸ Pause" : "▶ Play"}
          </button>
        </div>

        {/* editing surface */}
        <div className="flex-1 overflow-y-auto p-4 flex gap-5 justify-center">
          <div className="flex flex-col items-center gap-3">
            {app.kind === "emoji" && (
              <>
                <div className="relative bg-white/5 rounded-xl p-6 grid place-items-center" style={{ width: 190, height: 190 }}>
                  {onionApp && (
                    <div className="absolute inset-0 grid place-items-center opacity-25 pointer-events-none">
                      <div style={{ width: 120, height: 120, containerType: "inline-size" }}>
                        <Sprite app={onionApp} sizeCqw={78} />
                      </div>
                    </div>
                  )}
                  <div className="text-[86px] leading-none">{app.char}</div>
                </div>
                <input
                  value={app.char}
                  onChange={(e) => patchFrame({ kind: "emoji", char: e.target.value.slice(0, 3) })}
                  className={inp + " text-center text-2xl w-28"}
                  placeholder="😎"
                />
                <div className="max-w-md max-h-40 overflow-y-auto flex flex-wrap gap-0.5 justify-center bg-black/20 rounded p-2">
                  {Array.from(EMOJI_TRAY).map((c, i) => (
                    <button
                      key={i}
                      onClick={() => patchFrame({ kind: "emoji", char: c })}
                      className="text-xl hover:scale-125 transition w-7 h-7 leading-none"
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-white/35 max-w-xs text-center leading-snug">
                  Emoji are placeholder <em>references</em>, not baked-in text — swap any cel to
                  pixels or a bitmap later and nothing else in your game changes.
                </p>
              </>
            )}

            {app.kind === "pixel" && (
              <PixelEditor value={app} onChange={patchFrame} onionApp={onionApp ?? null} />
            )}

            {app.kind === "shape" && (
              <div className="flex flex-col items-center gap-3">
                <div className="bg-white/5 rounded-xl p-4" style={{ width: 190, height: 190 }}>
                  <Sprite app={app} sizeCqw={70} />
                </div>
                <div className="flex gap-1">
                  {(["rect", "ellipse", "triangle", "star"] as const).map((sh) => (
                    <button
                      key={sh}
                      onClick={() => patchFrame({ ...app, shape: sh })}
                      className={`px-2 py-1 rounded text-xs font-bold ${app.shape === sh ? "bg-fuchsia-600" : "bg-white/10"}`}
                    >
                      {sh}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <span className={lbl}>Fill</span>
                  <input
                    type="color"
                    value={app.fill}
                    onChange={(e) => patchFrame({ ...app, fill: e.target.value })}
                    className="w-10 h-7 bg-transparent rounded cursor-pointer"
                  />
                </label>
              </div>
            )}
          </div>

          {/* live preview at tempo */}
          <div className="flex flex-col items-center gap-2">
            <div className={lbl}>Live</div>
            <div
              className="rounded-xl bg-black/40 border border-white/10 grid place-items-center"
              style={{ width: 130, height: 130, containerType: "inline-size" }}
            >
              <div style={{ width: "72%", height: "72%", containerType: "inline-size" }}>
                <Sprite
                  app={costume.frames[playing ? Math.min(previewFrame, costume.frames.length - 1) : fi]?.app ?? null}
                  sizeCqw={70}
                />
              </div>
            </div>
            <div className="text-[10px] text-white/35 text-center leading-tight">
              plays at game
              <br />
              tempo (124 BPM)
            </div>
          </div>
        </div>

        {/* ---- frame strip ---- */}
        <div className="border-t border-white/10 bg-zinc-900/60 p-2">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={lbl}>Frames</span>
            <button onClick={addFrame} className="text-[11px] px-2 py-0.5 rounded bg-fuchsia-600 hover:bg-fuchsia-500 font-bold">+ Cel</button>
            <button onClick={delFrame} disabled={costume.frames.length <= 1} className="text-[11px] px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 font-bold">− Cel</button>
            <button onClick={() => moveFrame(-1)} className="text-[11px] px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 font-bold">◀ Move</button>
            <button onClick={() => moveFrame(1)} className="text-[11px] px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 font-bold">Move ▶</button>

            <div className="w-px h-4 bg-white/10 mx-1" />

            <span className={lbl}>Hold</span>
            <select
              value={frame?.hold ?? 0.25}
              onChange={(e) => patchHold(parseFloat(e.target.value))}
              className={inp + " text-xs"}
              title="How long this cel lasts, in beats — so animation keeps time when the game speeds up"
            >
              <option value={0.125} className="bg-zinc-800">1/8 beat</option>
              <option value={0.25} className="bg-zinc-800">1/4 beat</option>
              <option value={0.5} className="bg-zinc-800">1/2 beat</option>
              <option value={1} className="bg-zinc-800">1 beat</option>
              <option value={2} className="bg-zinc-800">2 beats</option>
            </select>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {costume.frames.map((f, i) => (
              <button
                key={i}
                onClick={() => setFi(i)}
                className={`shrink-0 rounded border p-1 ${
                  i === fi ? "border-fuchsia-500 bg-fuchsia-600/20" : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
                style={{ width: 54 }}
              >
                <div className="w-full aspect-square grid place-items-center bg-black/40 rounded overflow-hidden" style={{ containerType: "inline-size" }}>
                  <div style={{ width: "82%", height: "82%", containerType: "inline-size" }}>
                    <Sprite app={f.app} sizeCqw={62} />
                  </div>
                </div>
                <div className="text-[9px] text-white/40 mt-0.5">{i + 1}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
