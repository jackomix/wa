import React from 'react';
import { MascotCharacter } from '../utils/characters';
import { sound } from '../utils/soundEngine';

interface CabinetWrapperProps {
  character: MascotCharacter;
  keysPressed: { [key: string]: boolean };
  onButtonTrigger: (action: 'left' | 'right' | 'up' | 'down' | 'space' | 'start') => void;
  children: React.ReactNode;
}

export const CabinetWrapper: React.FC<CabinetWrapperProps> = ({
  character,
  keysPressed,
  onButtonTrigger,
  children,
}) => {
  const getCabinetStyle = () => {
    switch (character.id) {
      case 'wario':
        return {
          bg: 'bg-yellow-500',
          border: 'border-purple-800',
          accent: 'bg-purple-700',
          logo: '💛 WARIO MFG 💛',
          buttons: 'bg-purple-600 active:bg-purple-800 text-yellow-100',
          screws: 'border-yellow-600',
          decals: ['🧄', '🪙', '💰', '💥'],
        };
      case 'ninevolt':
        return {
          bg: 'bg-zinc-800',
          border: 'border-red-600',
          accent: 'bg-red-600',
          logo: '🎮 NINTENDO 8-BIT 🎮',
          buttons: 'bg-red-500 active:bg-red-700 text-zinc-100',
          screws: 'border-zinc-900',
          decals: ['🍄', '⭐', '👾', '🔥'],
        };
      case 'ashley':
        return {
          bg: 'bg-rose-950',
          border: 'border-red-900',
          accent: 'bg-red-800',
          logo: '🔮 ASHLEY MAGIC 🔮',
          buttons: 'bg-red-700 active:bg-red-900 text-rose-100',
          screws: 'border-rose-900',
          decals: ['🧙‍♀️', '🦇', '💀', '🕯️'],
        };
      case 'jimmy':
        return {
          bg: 'bg-pink-500',
          border: 'border-cyan-400',
          accent: 'bg-cyan-500',
          logo: '🕺 DISCO FEVER 🕺',
          buttons: 'bg-cyan-600 active:bg-cyan-800 text-pink-100',
          screws: 'border-pink-600',
          decals: ['🕶️', '🕺', '🔥', '🪩'],
        };
      case 'orbulon':
        return {
          bg: 'bg-teal-600',
          border: 'border-indigo-900',
          accent: 'bg-indigo-900',
          logo: '🛸 ORBULON-3000 🛸',
          buttons: 'bg-indigo-700 active:bg-indigo-900 text-teal-100',
          screws: 'border-teal-700',
          decals: ['🧠', '👽', '🪐', '📡'],
        };
      default:
        return {
          bg: 'bg-zinc-800',
          border: 'border-zinc-900',
          accent: 'bg-zinc-700',
          logo: 'WARIOWARE',
          buttons: 'bg-red-600 active:bg-red-800 text-zinc-100',
          screws: 'border-zinc-700',
          decals: [],
        };
    }
  };

  const cStyle = getCabinetStyle();

  const handlePress = (action: 'left' | 'right' | 'up' | 'down' | 'space' | 'start') => {
    sound.playSFX('click');
    onButtonTrigger(action);
  };

  return (
    <div className={`relative max-w-2xl w-full flex flex-col items-center rounded-3xl p-6 md:p-8 shadow-2xl transition-all duration-500 select-none ${cStyle.bg} border-t-8 border-r-4 border-l-4 border-b-[16px] ${cStyle.border}`}>
      {/* Screw holes top corners */}
      <div className="absolute top-3 left-6 flex items-center justify-center w-5 h-5 rounded-full bg-black/25">
        <div className={`w-3 h-3 rounded-full border border-dashed ${cStyle.screws} bg-zinc-700/60 rotate-45`}></div>
      </div>
      <div className="absolute top-3 right-6 flex items-center justify-center w-5 h-5 rounded-full bg-black/25">
        <div className={`w-3 h-3 rounded-full border border-dashed ${cStyle.screws} bg-zinc-700/60 -rotate-45`}></div>
      </div>

      {/* Retro Brand/Logo */}
      <div className="mb-4 text-center">
        <h1 className="text-white text-xs md:text-sm font-bold tracking-widest font-mono select-none drop-shadow-md">
          {cStyle.logo}
        </h1>
        <div className="w-16 h-1 bg-black/25 mx-auto mt-1 rounded"></div>
      </div>

      {/* Screen Frame Bevel */}
      <div className="relative w-full bg-black rounded-2xl p-4 md:p-6 shadow-inner border-t-4 border-black/40">
        {/* On-screen LED light indicator */}
        <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center gap-1.5 flex-col z-10">
          <div className={`w-2.5 h-2.5 rounded-full shadow-lg transition-all duration-300 ${keysPressed ? 'bg-red-500 animate-pulse shadow-red-500' : 'bg-red-800'}`}></div>
          <span className="text-[7px] text-zinc-500 font-bold tracking-tighter">PWR</span>
        </div>

        {/* Outer screen content container with CRT effects */}
        <div className="relative overflow-hidden rounded-lg aspect-[4/3] bg-zinc-950 shadow-2xl">
          {children}

          {/* CRT Scanline Overlay */}
          <div className="absolute inset-0 pointer-events-none z-40 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,6px_100%] opacity-90"></div>

          {/* Screen Curvature Vignette Shadow */}
          <div className="absolute inset-0 pointer-events-none z-30 shadow-[inset_0_0_20px_rgba(0,0,0,0.7)]"></div>

          {/* Screen Glare Highlight */}
          <div className="absolute top-0 left-0 w-full h-[150%] bg-gradient-to-b from-white/10 to-transparent transform -skew-y-12 origin-top-left pointer-events-none z-30"></div>
        </div>
      </div>

      {/* Retro Speaker Grill Slits */}
      <div className="w-full flex items-center justify-between px-4 mt-5">
        <div className="flex gap-1">
          <div className="w-1.5 h-6 bg-black/35 rounded transform -skew-x-12"></div>
          <div className="w-1.5 h-6 bg-black/35 rounded transform -skew-x-12"></div>
          <div className="w-1.5 h-6 bg-black/35 rounded transform -skew-x-12"></div>
          <div className="w-1.5 h-6 bg-black/35 rounded transform -skew-x-12"></div>
        </div>
        <div className="flex gap-2">
          {cStyle.decals.map((decal, idx) => (
            <span key={idx} className="text-xl md:text-2xl filter drop-shadow-md select-none transform hover:scale-110 active:scale-95 cursor-pointer duration-100">
              {decal}
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          <div className="w-1.5 h-6 bg-black/35 rounded transform -skew-x-12"></div>
          <div className="w-1.5 h-6 bg-black/35 rounded transform -skew-x-12"></div>
          <div className="w-1.5 h-6 bg-black/35 rounded transform -skew-x-12"></div>
          <div className="w-1.5 h-6 bg-black/35 rounded transform -skew-x-12"></div>
        </div>
      </div>

      {/* Tactile Control Panel Buttons */}
      <div className="w-full grid grid-cols-3 items-center gap-4 mt-6 md:mt-8">
        {/* D-PAD (Arrow Keys replacement) */}
        <div className="flex justify-center items-center">
          <div className="relative w-28 h-28 flex items-center justify-center">
            {/* Center Core of D-Pad */}
            <div className="w-10 h-10 bg-zinc-900 rounded-sm shadow-inner z-10 border border-zinc-950"></div>

            {/* D-Pad Buttons */}
            {/* LEFT */}
            <button
              onClick={() => handlePress('left')}
              className={`absolute left-0 w-10 h-9 bg-zinc-800 active:bg-zinc-900 border-y border-l border-zinc-950 shadow-md flex items-center justify-center rounded-l-md transition-all duration-100 ${keysPressed['ArrowLeft'] ? 'scale-90 bg-zinc-950 translate-x-[2px]' : ''}`}
              title="Arrow Left"
            >
              <div className="w-0 h-0 border-t-6 border-b-6 border-r-6 border-t-transparent border-b-transparent border-r-zinc-400"></div>
            </button>

            {/* RIGHT */}
            <button
              onClick={() => handlePress('right')}
              className={`absolute right-0 w-10 h-9 bg-zinc-800 active:bg-zinc-900 border-y border-r border-zinc-950 shadow-md flex items-center justify-center rounded-r-md transition-all duration-100 ${keysPressed['ArrowRight'] ? 'scale-90 bg-zinc-950 -translate-x-[2px]' : ''}`}
              title="Arrow Right"
            >
              <div className="w-0 h-0 border-t-6 border-b-6 border-l-6 border-t-transparent border-b-transparent border-l-zinc-400"></div>
            </button>

            {/* UP */}
            <button
              onClick={() => handlePress('up')}
              className={`absolute top-0 w-9 h-10 bg-zinc-800 active:bg-zinc-900 border-x border-t border-zinc-950 shadow-md flex items-center justify-center rounded-t-md transition-all duration-100 ${keysPressed['ArrowUp'] ? 'scale-90 bg-zinc-950 translate-y-[2px]' : ''}`}
              title="Arrow Up"
            >
              <div className="w-0 h-0 border-l-6 border-r-6 border-b-6 border-l-transparent border-r-transparent border-b-zinc-400"></div>
            </button>

            {/* DOWN */}
            <button
              onClick={() => handlePress('down')}
              className={`absolute bottom-0 w-9 h-10 bg-zinc-800 active:bg-zinc-900 border-x border-b border-zinc-950 shadow-md flex items-center justify-center rounded-b-md transition-all duration-100 ${keysPressed['ArrowDown'] ? 'scale-90 bg-zinc-950 -translate-y-[2px]' : ''}`}
              title="Arrow Down"
            >
              <div className="w-0 h-0 border-l-6 border-r-6 border-t-6 border-l-transparent border-r-transparent border-t-zinc-400"></div>
            </button>
          </div>
        </div>

        {/* CENTER CONSOLE BUTTONS (Start & Select / Instructions) */}
        <div className="flex flex-col items-center gap-4 justify-center">
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <button
                onClick={() => handlePress('start')}
                className="w-10 h-2 bg-zinc-800 border border-black shadow-md rounded transform -rotate-12 active:bg-zinc-950 transition-all duration-700 cursor-pointer"
                title="SELECT (Mute/Unmute)"
              ></button>
              <span className="text-[7px] text-white/70 font-bold font-mono tracking-wider mt-1 uppercase select-none">SELECT</span>
            </div>
            <div className="flex flex-col items-center">
              <button
                onClick={() => handlePress('start')}
                className="w-10 h-2 bg-zinc-800 border border-black shadow-md rounded transform -rotate-12 active:bg-zinc-950 transition-all duration-700 cursor-pointer"
                title="START"
              ></button>
              <span className="text-[7px] text-white/70 font-bold font-mono tracking-wider mt-1 uppercase select-none">START</span>
            </div>
          </div>
          <span className="text-[8px] text-black/45 font-bold tracking-widest text-center select-none font-mono">
            PRESS ENTER FOR CONTROLS
          </span>
        </div>

        {/* ACTION BUTTONS (A & B / Space bar replacement) */}
        <div className="flex justify-center items-center gap-3">
          <div className="flex flex-col items-center">
            <button
              onClick={() => handlePress('space')}
              className={`w-11 h-11 rounded-full ${cStyle.buttons} border border-black/55 shadow-lg flex items-center justify-center font-bold text-base transition-all duration-100 cursor-pointer ${keysPressed['Space'] ? 'scale-90 shadow-sm translate-y-[2px]' : ''}`}
              title="A Button (Space Bar)"
            >
              A
            </button>
            <span className="text-[9px] text-white font-bold font-mono mt-1 select-none">SPACE</span>
          </div>

          <div className="flex flex-col items-center">
            <button
              onClick={() => handlePress('space')}
              className={`w-11 h-11 rounded-full ${cStyle.buttons} opacity-85 border border-black/55 shadow-lg flex items-center justify-center font-bold text-base transition-all duration-100 cursor-pointer ${keysPressed['Space'] ? 'scale-90 shadow-sm translate-y-[2px]' : ''}`}
              title="B Button (Space Bar)"
            >
              B
            </button>
            <span className="text-[9px] text-white font-bold font-mono mt-1 select-none">ESC</span>
          </div>
        </div>
      </div>
    </div>
  );
};
