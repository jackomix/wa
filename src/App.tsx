import { useState, useEffect, useCallback, useRef } from 'react';
import { CHARACTERS, MICROGAMES, MascotCharacter, MicrogameDef } from './utils/characters';
import { sound } from './utils/soundEngine';
import { CabinetWrapper } from './components/CabinetWrapper';
import { MicrogameRenderer } from './components/MicrogameRenderer';

export default function App() {
  // Screen States
  // 'title' | 'character_select' | 'instructions_test' | 'game_intro' | 'transition' | 'playing' | 'speed_up' | 'stage_clear' | 'game_over'
  const [appState, setAppState] = useState<string>('title');
  const [selectedChar, setSelectedChar] = useState<MascotCharacter>(CHARACTERS[0]);
  const [highScores, setHighScores] = useState<{ [key: string]: number }>({});
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Active Game Session Variables
  const [score, setScore] = useState<number>(0);
  const [lives, setLives] = useState<number>(4);
  const [tempo, setTempo] = useState<number>(130);
  const [beatIndex, setBeatIndex] = useState<number>(0);
  const [gameDifficulty, setGameDifficulty] = useState<number>(1);
  const [completedInStretch, setCompletedInSpeedupStretch] = useState<number>(0);
  const [previousWin, setPreviousWin] = useState<boolean>(true);

  // Active microgame tracker
  const [currentGame, setCurrentGame] = useState<MicrogameDef>(MICROGAMES[0]);
  const [playedHistory, setPlayedHistory] = useState<string[]>([]);
  const [isBossStage, setIsBossStage] = useState<boolean>(false);

  // Input states
  const [keysPressed, setKeysPressed] = useState<{ [key: string]: boolean }>({});

  // Quick Instruction Test variables
  const [testGame, setTestGame] = useState<MicrogameDef>(MICROGAMES[0]);
  const [testDifficulty, setTestDifficulty] = useState<number>(1);
  const [testResult, setTestResult] = useState<{
    status: 'idle' | 'success' | 'failure';
    clearTimeMs: number;
    clearBeat: number;
    framerule: string;
    grade: string;
  } | null>(null);
  const [testKey, setTestKey] = useState<number>(0); // key to force re-render test game

  const beatIndexRef = useRef<number>(0);
  const appStateRef = useRef<string>('title');
  const timerLock = useRef<boolean>(false);

  // Sync ref to avoid closure staleness in sound scheduler callback
  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  // Load High Scores from localStorage
  useEffect(() => {
    const scores: { [key: string]: number } = {};
    CHARACTERS.forEach(char => {
      const stored = localStorage.getItem(`warioware_highscore_${char.id}`);
      scores[char.id] = stored ? parseInt(stored, 10) : 0;
    });
    setHighScores(scores);
  }, []);

  const saveHighScore = (charId: string, finalScore: number) => {
    const currentHigh = highScores[charId] || 0;
    if (finalScore > currentHigh) {
      localStorage.setItem(`warioware_highscore_${charId}`, finalScore.toString());
      setHighScores(prev => ({ ...prev, [charId]: finalScore }));
      sound.playSFX('unlock');
    }
  };

  // Sound Engine Mute sync
  const toggleMute = () => {
    const currentMuted = sound.getMuted();
    sound.setMuted(!currentMuted);
    setIsMuted(!currentMuted);
    sound.playSFX('click');
  };

  // Keyboard Event Watchers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent scrolling defaults
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }

      setKeysPressed(prev => ({ ...prev, [e.code]: true }));

      // Global hotkey to open help/controls (Enter key)
      if (e.code === 'Enter') {
        alert("WarioWare Controls:\n\n◀ ▶ ▲ ▼ Arrow Keys : Move / Rotate Dials / Select cards\nSPACE BAR : Jump / Chop / Grab Toast / Shoot Missile\nESC / Click On-Screen select: Back to Menu / Exit");
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      setKeysPressed(prev => ({ ...prev, [e.code]: false }));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Set game difficulty based on progressive score
  useEffect(() => {
    if (score < 4) {
      setGameDifficulty(1);
    } else if (score < 8) {
      setGameDifficulty(2);
    } else {
      setGameDifficulty(3);
    }
  }, [score]);

  // Select next randomized game
  const selectNextMicrogame = useCallback(() => {
    // If we have completed exactly 8 games in this loop, trigger Boss!
    if (score === 8) {
      setIsBossStage(true);
      const bossDef = MICROGAMES.find(g => g.id === 'boss_game');
      if (bossDef) {
        setCurrentGame(bossDef);
      }
      return;
    }

    setIsBossStage(false);
    // Get valid games for character or global selection
    const pool = selectedChar.gamePool;
    // Filter out games we played recently, unless all have been played
    let available = MICROGAMES.filter(g => pool.includes(g.id) && g.id !== 'boss_game');
    if (available.length === 0) {
      available = MICROGAMES.filter(g => g.id !== 'boss_game');
    }

    let unplayed = available.filter(g => !playedHistory.includes(g.id));
    if (unplayed.length === 0) {
      unplayed = available;
      setPlayedHistory([]);
    }

    const chosen = unplayed[Math.floor(Math.random() * unplayed.length)];
    setCurrentGame(chosen);
    setPlayedHistory(prev => [...prev, chosen.id]);
  }, [score, selectedChar, playedHistory]);

  // GAME LOOP TRANSITIONS (RHYTHMIC SEQUENCER)
  const onBeatTick = useCallback((beat: number, _time: number) => {
    const activeState = appStateRef.current;

    // Transition state handles a 4-beat bar intermission
    if (activeState === 'transition') {
      const intermissionBeat = beat % 4;
      setBeatIndex(intermissionBeat);
      beatIndexRef.current = intermissionBeat;

      // On 3rd beat, display instruction command, pre-buffer state
      if (intermissionBeat === 2) {
        sound.playSFX('click');
      }

      // On 4th beat, play retro chiptune prep tick
      if (intermissionBeat === 3) {
        sound.playSFX('tick');
      }

      // Transition finishes at end of 4th beat
      if (intermissionBeat === 3) {
        // Scheduler timing safety delay before changing state
        setTimeout(() => {
          setAppState('playing');
          sound.resetBeatCount();
          setBeatIndex(0);
          beatIndexRef.current = 0;
        }, (60 / tempo) * 1000 - 40); // 40ms cushion for state transition
      }
    }

    // Active gameplay lasts 8 beats (or 16 for double length)
    else if (activeState === 'playing') {
      const limit = currentGame.isDoubleLength ? 16 : 8;
      const gameBeat = beat % (limit + 1);

      setBeatIndex(gameBeat);
      beatIndexRef.current = gameBeat;

      // Play ticking warning sound during final 4 beats
      if (gameBeat >= limit - 4 && gameBeat < limit) {
        sound.playSFX('tick');
      }

      // Time expires on the final beat, triggering fail
      if (gameBeat === limit) {
        sound.playSFX('explosion');
        handleGameLose();
      }
    }
  }, [currentGame, tempo]);

  // Start Rhythmic Sequence Beat Loop
  useEffect(() => {
    if (appState === 'transition' || appState === 'playing') {
      sound.startBeatLoop(onBeatTick);
    } else {
      sound.stopBeatLoop();
    }
    return () => sound.stopBeatLoop();
  }, [appState, onBeatTick]);

  // Action handoffs for game victory/loss
  const handleGameWin = (_clearBeat: number) => {
    if (timerLock.current) return;
    timerLock.current = true;

    setScore(prev => prev + 1);
    setPreviousWin(true);
    setCompletedInSpeedupStretch(prev => prev + 1);

    // SPEEDUP AND BOSS LOGIC CHECKS
    const nextScore = score + 1;

    setTimeout(() => {
      timerLock.current = false;
      if (isBossStage) {
        setAppState('stage_clear');
      } else if (nextScore > 0 && nextScore % 4 === 0) {
        // Trigger Speedup Screen
        setAppState('speed_up');
      } else {
        // Next game intermission
        selectNextMicrogame();
        setAppState('transition');
        sound.resetBeatCount();
      }
    }, 1200); // 1.2s freeze playaround window (GBA standard!)
  };

  const handleGameLose = () => {
    if (timerLock.current) return;
    timerLock.current = true;

    const nextLives = lives - 1;
    setLives(nextLives);
    setPreviousWin(false);

    setTimeout(() => {
      timerLock.current = false;
      if (nextLives <= 0) {
        saveHighScore(selectedChar.id, score);
        setAppState('game_over');
        sound.playSFX('gameover');
      } else {
        selectNextMicrogame();
        setAppState('transition');
        sound.resetBeatCount();
      }
    }, 1500); // Fail freeze-frame duration
  };

  // Launch New Game Campaign
  const startNewRun = (char: MascotCharacter) => {
    setSelectedChar(char);
    setScore(0);
    setLives(4);
    setTempo(char.startBpm);
    sound.setTempo(char.startBpm);
    setCompletedInSpeedupStretch(0);
    setPreviousWin(true);
    setPlayedHistory([]);
    setIsBossStage(false);

    // Initial randomized game
    const pool = char.gamePool;
    const initialGame = MICROGAMES.find(g => pool.includes(g.id)) || MICROGAMES[0];
    setCurrentGame(initialGame);

    setAppState('game_intro');
    sound.playSFX(char.jingleType);
  };

  // Execute Speedup transition
  const executeSpeedUp = () => {
    const newBpm = Math.min(240, tempo + 15);
    setTempo(newBpm);
    sound.setTempo(newBpm);
    setCompletedInSpeedupStretch(0);
    selectNextMicrogame();
    setAppState('transition');
    sound.resetBeatCount();
  };

  // Mobile/On-screen D-Pad simulation trigger
  const handleOnScreenButton = (action: 'left' | 'right' | 'up' | 'down' | 'space' | 'start') => {
    if (action === 'start') {
      toggleMute();
      return;
    }

    const codeMap: { [key: string]: string } = {
      left: 'ArrowLeft',
      right: 'ArrowRight',
      up: 'ArrowUp',
      down: 'ArrowDown',
      space: 'Space',
    };

    const key = codeMap[action];
    if (!key) return;

    // Simulate standard down-up keypress
    setKeysPressed(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setKeysPressed(prev => ({ ...prev, [key]: false }));
    }, 120);

    // Synthesize quick event dispatch to communicate with the canvas element directly
    const event = new KeyboardEvent('keydown', { code: key });
    window.dispatchEvent(event);
  };

  // CALIBRATION & INSTRUCTION TEST PRACTICE ENGINE
  const handleStartPracticeTest = () => {
    setTestResult(null);
    setTestKey(prev => prev + 1);
  };

  const onPracticeWin = (clearBeat: number) => {
    const elapsedSecs = (clearBeat * 60) / selectedChar.startBpm;
    const elapsedMs = Math.round(elapsedSecs * 1000);

    // Speedrunner framerules calibration analysis
    let framerule = 'Framerule 3 (Beat 8)';
    let grade = 'B-Grade (Casual)';

    // Evaluated at standard classic framerules
    if (clearBeat <= 4.0) {
      framerule = 'Framerule 1 (Beat 4)';
      grade = 'S-Grade (TAS / Perfect!)';
    } else if (clearBeat <= 6.0) {
      framerule = 'Framerule 2 (Beat 6)';
      grade = 'A-Grade (Speedrun Pro)';
    }

    setTestResult({
      status: 'success',
      clearTimeMs: elapsedMs,
      clearBeat,
      framerule,
      grade,
    });
  };

  const onPracticeLose = () => {
    setTestResult({
      status: 'failure',
      clearTimeMs: 0,
      clearBeat: 0,
      framerule: 'Expired / Bomb Exploded',
      grade: 'F-Grade (Game Over)',
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 md:p-8 relative font-arcade text-white overflow-x-hidden selection:bg-pink-500 selection:text-white">
      {/* Decorative cyber backdrop circles */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-purple-900/10 rounded-full filter blur-3xl -z-10 animate-bounce-slow"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-pink-900/10 rounded-full filter blur-3xl -z-10 animate-bounce-slow" style={{ animationDelay: '1s' }}></div>

      {/* Mute Control Bar */}
      <div className="w-full max-w-2xl flex justify-between items-center mb-4 text-[10px] md:text-xs z-50">
        <span className="text-zinc-500 font-mono">WARIOWARE GBA REPLICA // TAS-CALIBRATED</span>
        <button
          onClick={toggleMute}
          className="px-3 py-1.5 rounded bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-mono flex items-center gap-1 transition-all"
        >
          {isMuted ? '🔇 MUTED' : '🔊 RETRO SYNTH'}
        </button>
      </div>

      {/* CABINET GAMEPLAY INTERFACE CONTAINER */}
      <CabinetWrapper
        character={selectedChar}
        keysPressed={keysPressed}
        onButtonTrigger={handleOnScreenButton}
      >
        {/* CRT SCREEN PORT HOLE */}
        <div className="w-full h-full relative flex flex-col justify-between overflow-hidden">
          
          {/* SCREEN STATE 1: TITLE SCREEN */}
          {appState === 'title' && (
            <div className="absolute inset-0 bg-gradient-to-b from-purple-900 via-purple-950 to-indigo-950 flex flex-col justify-between p-6 text-center select-none animate-siren-strobe" style={{ animationDuration: '4s' }}>
              <div className="mt-4 flex flex-col items-center">
                <div className="relative transform hover:scale-105 transition-all duration-300">
                  <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 to-pink-500 rounded-lg blur opacity-75 group-hover:opacity-100 animate-pulse"></div>
                  <div className="relative px-4 py-3 bg-black rounded-lg">
                    <h1 className="text-2xl md:text-3xl font-extrabold text-yellow-400 font-arcade select-none tracking-tighter drop-shadow-md">
                      WARIO<span className="text-pink-500">WARE</span>
                    </h1>
                  </div>
                </div>
                <p className="text-[9px] text-yellow-300 mt-2 tracking-widest font-mono">MICRO-MADNESS RETRO REPLICA</p>
              </div>

              {/* Main character animation */}
              <div className="my-2 flex justify-center items-center gap-3">
                <span className="text-4xl animate-wario-shake">😈</span>
                <span className="text-4xl animate-bounce-slow">👾</span>
                <span className="text-4xl animate-wario-shake" style={{ animationDelay: '0.2s' }}>⚡</span>
              </div>

              <div className="flex flex-col gap-3">
                {/* START BUTTON */}
                <button
                  onClick={() => {
                    sound.playSFX('select');
                    setAppState('character_select');
                  }}
                  className="w-full py-3.5 bg-yellow-400 hover:bg-yellow-300 text-black font-extrabold rounded-lg shadow-lg transform active:scale-95 duration-100 border-2 border-white cursor-pointer hover:shadow-yellow-500/30 text-xs tracking-wider"
                >
                  ▶ PRESS START GAME ◀
                </button>

                {/* PRACTICE TEST BUTTON */}
                <button
                  onClick={() => {
                    sound.playSFX('unlock');
                    setAppState('instructions_test');
                    handleStartPracticeTest();
                  }}
                  className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-pink-400 font-bold rounded-lg border border-zinc-800 transform active:scale-95 duration-100 cursor-pointer text-[10px]"
                >
                  🚀 SPEEDRUN TEST CALIBRATION
                </button>
              </div>

              <p className="text-[7px] text-zinc-500 font-mono tracking-tighter">© 2026 WARIO MFG. COMPATIBLE WITH GBA FRAME RULES.</p>
            </div>
          )}

          {/* SCREEN STATE 2: CHARACTER SELECT */}
          {appState === 'character_select' && (
            <div className="absolute inset-0 bg-slate-900 flex flex-col justify-between p-4 text-center">
              <div>
                <h2 className="text-xs md:text-sm text-yellow-400 tracking-wider">CHOOSE YOUR MASCOT</h2>
                <div className="w-16 h-0.5 bg-yellow-400 mx-auto mt-1 rounded"></div>
              </div>

              {/* Character selection tiles grid */}
              <div className="grid grid-cols-5 gap-1.5 my-2">
                {CHARACTERS.map(char => {
                  const isSel = selectedChar.id === char.id;
                  const scoreMax = highScores[char.id] || 0;
                  return (
                    <button
                      key={char.id}
                      onClick={() => {
                        sound.playSFX('click');
                        setSelectedChar(char);
                      }}
                      className={`flex flex-col items-center justify-between p-1 rounded border-2 transition-all duration-150 ${isSel ? 'bg-indigo-950 border-pink-500 scale-105' : 'bg-slate-800/80 border-slate-700 hover:bg-slate-800'}`}
                    >
                      <span className="text-xl md:text-2xl mt-1">{char.moodEmojis.idle}</span>
                      <span className="text-[7px] font-bold text-white mt-1 leading-none">{char.name}</span>
                      <span className="text-[6px] text-zinc-400 font-mono mt-1">HI:{scoreMax}</span>
                    </button>
                  );
                })}
              </div>

              {/* Mascot Description Card */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-left">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-pink-400 text-[10px] uppercase font-bold">{selectedChar.name} - {selectedChar.tagline}</h3>
                  <span className="text-[8px] text-teal-400 font-mono">START: {selectedChar.startBpm} BPM</span>
                </div>
                <p className="text-[8px] text-zinc-400 font-sans leading-relaxed">{selectedChar.desc}</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    sound.playSFX('click');
                    setAppState('title');
                  }}
                  className="w-1/3 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded border border-zinc-700 text-[10px]"
                >
                  ◀ BACK
                </button>
                <button
                  onClick={() => startNewRun(selectedChar)}
                  className="w-2/3 py-2.5 bg-pink-500 hover:bg-pink-400 text-white rounded shadow-md font-bold text-[11px] animate-pulse"
                >
                  START STAGE ▶
                </button>
              </div>
            </div>
          )}

          {/* SCREEN STATE 3: QUICK INSTRUCTION SPEEDRUN CALIBRATION TEST */}
          {appState === 'instructions_test' && (
            <div className="absolute inset-0 bg-slate-950 flex flex-col justify-between p-3 select-none overflow-y-auto">
              {/* Header */}
              <div className="flex justify-between items-center border-b border-zinc-800 pb-1.5">
                <div>
                  <h2 className="text-[9px] text-pink-400 tracking-wider">SPEEDRUN CALIBRATOR</h2>
                  <p className="text-[6px] text-zinc-500 font-mono uppercase">Inspect Microgames & Framerule Windows</p>
                </div>
                <button
                  onClick={() => {
                    sound.playSFX('click');
                    setAppState('title');
                  }}
                  className="px-2 py-0.5 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 rounded text-[7px]"
                >
                  BACK ◀
                </button>
              </div>

              {/* Practice Content Grid Split */}
              <div className="grid grid-cols-5 gap-2 my-2 flex-grow min-h-0">
                {/* Microgames selection side-list */}
                <div className="col-span-2 flex flex-col gap-1 overflow-y-auto pr-1">
                  {MICROGAMES.map(g => {
                    const isSel = testGame.id === g.id;
                    return (
                      <button
                        key={g.id}
                        onClick={() => {
                          sound.playSFX('click');
                          setTestGame(g);
                          setTestResult(null);
                          setTestKey(prev => prev + 1);
                        }}
                        className={`py-1 px-1.5 text-left rounded text-[7px] border flex flex-col gap-0.5 transition-all leading-tight ${isSel ? 'bg-pink-500/20 text-pink-400 border-pink-500' : 'bg-zinc-900/60 border-zinc-800 hover:bg-zinc-900 text-zinc-300'}`}
                      >
                        <span className="font-bold truncate">{g.name}</span>
                        <span className="text-[5px] text-zinc-500 italic font-mono uppercase tracking-tighter">{g.command}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Live Sandbox viewport */}
                <div className="col-span-3 flex flex-col justify-between bg-zinc-900 rounded p-2 border border-zinc-800 relative">
                  {/* Microgame Command Warning Banner */}
                  <div className="text-center">
                    <span className="text-[7px] text-zinc-400 uppercase font-mono tracking-widest block mb-0.5">COMMAND INSTRUCTION</span>
                    <span className="text-[12px] bg-red-600 px-2 py-0.5 text-white inline-block tracking-widest uppercase font-extrabold animate-pulse rounded border border-white">
                      {testGame.command}
                    </span>
                  </div>

                  {/* Sandbox interactive frame */}
                  <div className="relative aspect-[4/3] w-full max-w-[140px] mx-auto border-2 border-pink-500 rounded overflow-hidden">
                    <MicrogameRenderer
                      key={`${testGame.id}_${testDifficulty}_${testKey}`}
                      gameId={testGame.id}
                      difficulty={testDifficulty}
                      tempo={selectedChar.startBpm}
                      beatIndex={0}
                      isActive={true}
                      keysPressed={keysPressed}
                      onWin={onPracticeWin}
                      onLose={onPracticeLose}
                    />
                  </div>

                  {/* Calibration Reset */}
                  <button
                    onClick={handleStartPracticeTest}
                    className="w-full py-1 bg-pink-500 hover:bg-pink-400 text-white rounded text-[7px] tracking-wider"
                  >
                    🔄 RETRY / CALIBRATE
                  </button>
                </div>
              </div>

              {/* Diagnostic speedrun report card overlay */}
              <div className="bg-zinc-900 p-2 rounded-lg border border-zinc-800">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-1 mb-1">
                  <span className="text-[8px] text-yellow-400 font-bold uppercase">{testGame.name} DIAGNOSTIC REPORT</span>
                  <div className="flex gap-1">
                    {[1, 2, 3].map(d => (
                      <button
                        key={d}
                        onClick={() => {
                          sound.playSFX('click');
                          setTestDifficulty(d);
                          setTestResult(null);
                          setTestKey(prev => prev + 1);
                        }}
                        className={`px-1.5 py-0.5 rounded text-[5px] font-mono ${testDifficulty === d ? 'bg-yellow-400 text-black font-bold' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'}`}
                      >
                        LVL {d}
                      </button>
                    ))}
                  </div>
                </div>

                {testResult ? (
                  <div className="grid grid-cols-2 gap-1.5 text-[7px] leading-relaxed">
                    <div className="flex flex-col gap-0.5">
                      <div>
                        <span className="text-zinc-500">STATUS:</span>{' '}
                        <span className={testResult.status === 'success' ? 'text-green-400 font-bold' : 'text-red-500 font-bold'}>
                          {testResult.status.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500">ELAPSED:</span>{' '}
                        <span className="text-white font-mono">{testResult.clearTimeMs}ms ({testResult.clearBeat} Beats)</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <div>
                        <span className="text-zinc-500">FRAMERULE:</span>{' '}
                        <span className="text-cyan-400 font-bold">{testResult.framerule}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">TAS RATING:</span>{' '}
                        <span className="text-pink-500 font-extrabold">{testResult.grade}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-[7px] py-1 text-zinc-500 animate-pulse uppercase">
                    Play the microgame inside the sandbox window to analyze frames...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SCREEN STATE 4: STAGE GAME INTRO CUTSCENE */}
          {appState === 'game_intro' && (
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-950 to-slate-950 flex flex-col justify-between p-4 text-center items-center">
              <div className="mt-4">
                <h2 className="text-[8px] text-zinc-400 tracking-wider">PREPARING STAGE...</h2>
                <div className="text-xs text-yellow-400 mt-2 font-bold font-mono tracking-widest">{selectedChar.name} WAREHOUSE</div>
              </div>

              {/* Graphic container */}
              <div className="relative w-28 h-28 flex items-center justify-center bg-black/40 rounded-full border-4 border-yellow-400 shadow-lg animate-wario-shake">
                <span className="text-5xl">{selectedChar.moodEmojis.ready}</span>
              </div>

              <div className="w-full flex flex-col gap-2">
                <div className="text-[7px] text-pink-400 tracking-tighter">GET READY... STAGE STARTING AT {tempo} BPM!</div>
                <button
                  onClick={() => {
                    selectNextMicrogame();
                    setAppState('transition');
                    sound.resetBeatCount();
                  }}
                  className="w-full py-2 bg-yellow-400 hover:bg-yellow-300 text-black rounded text-[10px] font-extrabold shadow-md border-b-4 border-yellow-600 hover:scale-105 transition-all duration-100 cursor-pointer"
                >
                  ▶ START MICROGAMES ◀
                </button>
              </div>
            </div>
          )}

          {/* SCREEN STATE 5: INTERMISSION TRANSITION DOOR / ELEVATOR */}
          {appState === 'transition' && (
            <div className="absolute inset-0 flex flex-col justify-between p-4 select-none overflow-hidden" style={{ background: selectedChar.bgGradient }}>
              {/* Dynamic Scrolling Stripes Pattern Background */}
              <div className="absolute inset-0 pointer-events-none opacity-10 flex flex-col gap-8 transform rotate-12 scale-125">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-6 w-full" style={{ backgroundColor: selectedChar.accentColor }}></div>
                ))}
              </div>

              {/* Top HUD bar */}
              <div className="flex justify-between items-center z-10">
                <div className="flex gap-1 items-center">
                  <span className="text-[8px] text-white/60">LIVES:</span>
                  <div className="flex gap-0.5">
                    {[...Array(4)].map((_, i) => (
                      <span
                        key={i}
                        className={`text-xs transition-transform duration-300 ${i < lives ? 'scale-100' : 'scale-0 grayscale'}`}
                      >
                        {selectedChar.avatarEmoji}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Speedup Stretch indicator */}
                <div className="text-[7px] text-yellow-300 font-mono tracking-wider animate-pulse">
                  STRETCH: {completedInStretch}/4
                </div>

                <div className="text-[8px] text-white/80 font-mono tracking-widest uppercase">
                  LVL: {gameDifficulty}
                </div>
              </div>

              {/* Central Elevator Mascot Screen */}
              <div className="flex flex-col items-center justify-center z-10 flex-grow py-2">
                {/* Character emotion head */}
                <div className="w-20 h-20 rounded-full border-4 bg-black/30 flex items-center justify-center shadow-lg border-white animate-bounce-slow">
                  <span className="text-4xl filter drop-shadow">
                    {previousWin ? selectedChar.moodEmojis.win : selectedChar.moodEmojis.lose}
                  </span>
                </div>

                {/* WIN COUNTER LED DISPLAY */}
                <div className="mt-3 text-center">
                  <span className="text-[7px] text-white/50 block mb-0.5 uppercase tracking-widest">GAMES COMPLETED</span>
                  <span className="text-3xl text-yellow-300 font-extrabold font-arcade tracking-tight drop-shadow-md">
                    {score < 10 ? `0${score}` : score}
                  </span>
                </div>
              </div>

              {/* Flashing instruction command word */}
              <div className="relative h-11 flex justify-center items-center z-20">
                {beatIndex >= 2 ? (
                  <div className="w-full bg-red-600 border-2 border-white py-1.5 text-center shadow-lg transform -rotate-1 animate-wario-shake">
                    <span className="text-xs md:text-sm font-black tracking-widest uppercase text-yellow-300 font-arcade animate-pulse select-none">
                      {currentGame.command}
                    </span>
                  </div>
                ) : (
                  <div className="text-center text-[7px] text-white/50 uppercase tracking-widest font-mono">
                    Next game preparing...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SCREEN STATE 6: ACTIVE GAMEPLAY */}
          {appState === 'playing' && (
            <div className="absolute inset-0 flex flex-col justify-between select-none">
              
              {/* Core canvas container */}
              <div className="relative flex-grow">
                <MicrogameRenderer
                  gameId={currentGame.id}
                  difficulty={gameDifficulty}
                  tempo={tempo}
                  beatIndex={beatIndex}
                  isActive={true}
                  keysPressed={keysPressed}
                  onWin={handleGameWin}
                  onLose={handleGameLose}
                />

                {/* Flashing instruction overlay on beat 0 & 1 */}
                {beatIndex < 1.8 && (
                  <div className="absolute inset-x-0 top-1/3 flex justify-center items-center pointer-events-none">
                    <div className="bg-red-600/95 border-2 border-white py-2 px-6 shadow-xl transform rotate-2 animate-wario-shake">
                      <span className="text-sm font-black tracking-widest uppercase text-yellow-300 font-arcade drop-shadow-sm select-none">
                        {currentGame.command}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom ticking bomb fuse bar */}
              <div className="h-6 bg-slate-950 border-t-2 border-slate-800 px-4 flex items-center justify-between relative overflow-hidden">
                <span className="text-[7px] text-pink-500 font-mono tracking-wider">
                  {currentGame.isDoubleLength ? 'DOUBLE LENGTH IQ STAGE' : 'TIME LIMIT'}
                </span>

                {/* Bomb fuse progress meter */}
                <div className="flex-grow mx-4 h-3 bg-zinc-900 border border-zinc-800 rounded-full relative overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 via-yellow-400 to-amber-500 rounded-full transition-all duration-100 ease-linear"
                    style={{
                      width: `${Math.max(0, 100 - (beatIndex / (currentGame.isDoubleLength ? 16 : 8)) * 100)}%`,
                    }}
                  />
                  {/* Glowing sparkle spark */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-yellow-300 rounded-full animate-pulse shadow-md shadow-yellow-500/80"
                    style={{
                      left: `calc(${Math.max(0, 100 - (beatIndex / (currentGame.isDoubleLength ? 16 : 8)) * 100)}% - 6px)`,
                    }}
                  />
                </div>

                {/* Spark / Bomb Icon */}
                <span className="text-xs z-10 animate-wario-shake">💣</span>
              </div>
            </div>
          )}

          {/* SCREEN STATE 7: SPEED UP WARNING ALARM */}
          {appState === 'speed_up' && (
            <div className="absolute inset-0 bg-red-600 flex flex-col justify-between p-6 text-center select-none animate-siren-strobe">
              <div className="mt-6 flex flex-col items-center">
                <span className="text-4xl animate-bounce">🚨</span>
                <h2 className="text-xl font-black text-yellow-300 font-arcade tracking-wider mt-4 animate-pulse">
                  SPEED UP!
                </h2>
                <div className="w-16 h-1 bg-yellow-300 mx-auto mt-2 rounded"></div>
              </div>

              <p className="text-[9px] text-white/90 font-mono uppercase tracking-widest leading-relaxed">
                THE MUSIC IS ACCELERATING!<br />
                BPM INCREASING TO {tempo + 15}!
              </p>

              <button
                onClick={() => {
                  sound.playSFX('click');
                  executeSpeedUp();
                }}
                className="w-full py-3.5 bg-yellow-400 hover:bg-yellow-300 text-black font-extrabold rounded-lg shadow-lg transform active:scale-95 duration-100 border-2 border-white cursor-pointer hover:shadow-yellow-500/30 text-xs tracking-wider"
              >
                💥 HERE WE GO! 💥
              </button>
            </div>
          )}

          {/* SCREEN STATE 8: STAGE CLEAR CELEBRATION */}
          {appState === 'stage_clear' && (
            <div className="absolute inset-0 bg-slate-900 flex flex-col justify-between p-6 text-center select-none overflow-y-auto">
              <div className="mt-4 flex flex-col items-center">
                <span className="text-5xl animate-bounce">👑</span>
                <h2 className="text-lg font-black text-green-400 font-arcade tracking-wider mt-4">
                  STAGE CLEAR!
                </h2>
                <div className="w-16 h-1 bg-green-400 mx-auto mt-2 rounded"></div>
              </div>

              <div className="bg-slate-950 p-4 rounded border border-slate-800 text-left my-2">
                <span className="text-[7px] text-pink-400 block mb-1 uppercase tracking-widest">STAGE REPORT CARD</span>
                <div className="grid grid-cols-2 gap-2 text-[8px] leading-relaxed">
                  <div>
                    <span className="text-zinc-500">MASCOT:</span>{' '}
                    <span className="text-white font-bold">{selectedChar.name}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">GAMES CLEARED:</span>{' '}
                    <span className="text-yellow-400 font-bold">{score}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">HIGHSCORE:</span>{' '}
                    <span className="text-cyan-400 font-bold">{highScores[selectedChar.id] || 0}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">FINAL BPM:</span>{' '}
                    <span className="text-red-400 font-mono">{tempo} BPM</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    sound.playSFX('click');
                    setAppState('title');
                  }}
                  className="w-1/2 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-[9px]"
                >
                  MENU ◀
                </button>
                <button
                  onClick={() => {
                    // Loop gameplay again with harder parameters
                    sound.playSFX('select');
                    setScore(0);
                    setLives(4);
                    setTempo(selectedChar.startBpm + 20);
                    sound.setTempo(selectedChar.startBpm + 20);
                    setIsBossStage(false);
                    selectNextMicrogame();
                    setAppState('transition');
                    sound.resetBeatCount();
                  }}
                  className="w-1/2 py-2 bg-green-500 hover:bg-green-400 text-white font-bold rounded text-[9px]"
                >
                  LOOP STAGE ▶
                </button>
              </div>
            </div>
          )}

          {/* SCREEN STATE 9: GAME OVER SCREEN */}
          {appState === 'game_over' && (
            <div className="absolute inset-0 bg-slate-950 flex flex-col justify-between p-6 text-center select-none">
              <div className="mt-4 flex flex-col items-center">
                <span className="text-5xl animate-pulse">💀</span>
                <h2 className="text-xl font-black text-red-500 font-arcade tracking-wider mt-4">
                  GAME OVER
                </h2>
                <div className="w-16 h-1 bg-red-500 mx-auto mt-2 rounded"></div>
              </div>

              <div className="p-3 bg-zinc-900 rounded border border-zinc-800 inline-block mx-auto max-w-[200px]">
                <span className="text-[7px] text-zinc-500 block mb-0.5 font-mono">YOUR FINAL SCORE</span>
                <span className="text-3xl text-white font-black font-arcade block leading-none">{score}</span>
                <span className="text-[6px] text-zinc-500 block mt-1 font-mono">BPM REACHED: {tempo}</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    sound.playSFX('click');
                    setAppState('title');
                  }}
                  className="w-1/2 py-2 bg-zinc-900 hover:bg-zinc-800 rounded border border-zinc-800 text-[9px]"
                >
                  MENU ◀
                </button>
                <button
                  onClick={() => {
                    sound.playSFX('select');
                    startNewRun(selectedChar);
                  }}
                  className="w-1/2 py-2 bg-pink-500 hover:bg-pink-400 text-white font-bold rounded text-[9px]"
                >
                  RETRY ▶
                </button>
              </div>
            </div>
          )}

        </div>
      </CabinetWrapper>

      {/* FOOTER CONTROLS BRIEF */}
      <footer className="mt-8 text-center text-[10px] text-zinc-500 font-mono tracking-wide leading-relaxed max-w-xl">
        <p>⌨ PHYSICAL KEYBOARD SHORTCUTS: <span className="text-zinc-300">ARROW KEYS</span> to navigate, <span className="text-zinc-300">SPACE BAR</span> for action / jump.</p>
        <p className="mt-1">💡 <span className="text-zinc-300">SPEEDRUN SECRETS:</span> Reaching Framerules 1 and 2 in the test calibration cuts down microgame lengths and saves total run times!</p>
      </footer>
    </div>
  );
}
