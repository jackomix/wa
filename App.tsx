import { useEffect, useState, type FC, type ReactNode } from "react";
import { useEngine, setEngineActive, requestStart } from "./engine/useEngine";
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

export default function App() {
  const { snap } = useEngine();
  const [view, setView] = useState<"game" | "editor">("game");
  const [editing, setEditing] = useState<MicrogameData | null>(null);
  const [showLib, setShowLib] = useState(false);

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
      {onTitle && !(snap.phase as any).startAtBeat && (
        <div className="absolute z-[85] left-1/2 -translate-x-1/2 flex gap-3" style={{ bottom: "9%" }}>
          <MenuButton color="#9ef01a" onClick={() => requestStart()}>
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
