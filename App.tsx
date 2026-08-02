import { useEffect, useState, type FC, type ReactNode } from "react";
import { useEngine, setEngineActive, requestStartStage, requestTitle } from "./engine/useEngine";
import {
  Doors,
  GameOverScreen,
  Instruction,
  InterludeUI,
  MicrogameLayer,
  RhythmHUD,
  Stage,
  TitleScreen,
} from "./components/Screens";
import { Editor, LibraryModal } from "./editor/Editor";
import { blankGame } from "./editor/library";
import type { MicrogameData } from "./editor/schema";
import { STAGES, STAGE_ORDER } from "./microgames";

export default function App() {
  const { snap } = useEngine();
  const [view, setView] = useState<"game" | "editor">("game");
  const [editing, setEditing] = useState<MicrogameData | null>(null);
  const [showLib, setShowLib] = useState(false);
  const [showStageSelect, setShowStageSelect] = useState(false);

  // pause the global rhythm engine while the editor is open
  useEffect(() => {
    setEngineActive(view === "game");
  }, [view]);

  if (view === "editor" && editing) {
    return (
      <Editor
        initial={editing}
        onClose={() => {
          setView("game");
          setEditing(null);
        }}
      />
    );
  }

  const openEditor = (d: MicrogameData) => {
    setEditing(d);
    setView("editor");
    setShowLib(false);
  };

  const onTitle = snap.phase.kind === "title";

  return (
    <Stage>
      <MicrogameLayer snap={snap} />
      <Doors open={snap.doorOpen} />
      <InterludeUI snap={snap} />
      <Instruction snap={snap} />
      <TitleScreen snap={snap} />
      <GameOverScreen snap={snap} />
      <RhythmHUD snap={snap} />

      {/* Menu over the title screen */}
      {onTitle && !(snap.phase as any).startAtBeat && !showStageSelect && (
        <div className="absolute z-[85] left-1/2 -translate-x-1/2 flex gap-3" style={{ bottom: "9%" }}>
          <MenuButton color="#9ef01a" onClick={() => setShowStageSelect(true)}>
            ▶ PLAY
          </MenuButton>
          <MenuButton color="#f72585" onClick={() => openEditor(blankGame())}>
            ✎ CREATE
          </MenuButton>
          <MenuButton color="#ffd60a" onClick={() => setShowLib(true)}>
            📚 LIBRARY
          </MenuButton>
        </div>
      )}

      {/* Stage Selection Panel */}
      {onTitle && showStageSelect && (
        <div className="absolute inset-0 z-[90] flex items-center justify-center bg-black/80">
          <div className="bg-[#1a1030] rounded-2xl border-2 border-[#8f7ff0] p-4 max-w-[85%] w-full" style={{ maxHeight: "80%" }}>
            <h2 className="font-black text-center mb-3" style={{ fontSize: "4cqw", color: "#ffd60a" }}>
              CHOOSE STAGE
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {STAGE_ORDER.map(id => {
                const s = STAGES[id];
                return (
                  <button key={id}
                    onClick={() => { setShowStageSelect(false); requestStartStage(id); }}
                    className="rounded-xl border-2 p-2 text-center transition-transform hover:scale-105 active:scale-95"
                    style={{
                      borderColor: s.colors.primary,
                      background: `${s.colors.bg}88`,
                    }}>
                    <div className="font-black" style={{ fontSize: "3cqw", color: s.colors.primary }}>
                      {s.name}
                    </div>
                    <div style={{ fontSize: "2cqw", color: "#8f7ff0" }}>
                      {s.character}
                    </div>
                    <div style={{ fontSize: "1.8cqw", color: "#8f7ff0" }}>
                      {s.startBpm} BPM
                    </div>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setShowStageSelect(false)}
              className="w-full mt-3 py-2 rounded-xl font-black bg-white/10 hover:bg-white/20"
              style={{ fontSize: "3cqw", color: "#8f7ff0" }}>
              ← BACK
            </button>
          </div>
        </div>
      )}

      {showLib && (
        <LibraryModal onClose={() => setShowLib(false)} onEdit={openEditor} />
      )}

      {/* Back-to-menu button during a run / game over */}
      {!onTitle && (
        <button
          onClick={() => requestTitle()}
          className="absolute z-[85] font-black px-3 py-1.5 rounded-lg bg-black/40 hover:bg-black/70 text-white/80"
          style={{ top: "2cqw", right: "2cqw", fontSize: "2cqw" }}
        >
          ☰ MENU
        </button>
      )}
    </Stage>
  );
}

const MenuButton: FC<{ color: string; onClick: () => void; children: ReactNode }> = ({
  color,
  onClick,
  children,
}) => (
  <button
    onClick={onClick}
    className="font-black px-6 py-3 rounded-2xl border-2 transition-transform hover:scale-105 active:scale-95"
    style={{
      color: "#14082b",
      background: color,
      borderColor: "rgba(255,255,255,0.5)",
      boxShadow: "0 0.6cqw 0 rgba(0,0,0,0.4)",
      fontSize: "2.6cqw",
    }}
  >
    {children}
  </button>
);
