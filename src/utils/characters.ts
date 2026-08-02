export interface MascotCharacter {
  id: string;
  name: string;
  tagline: string;
  desc: string;
  themeColor: string; // Tailwind class
  accentColor: string; // Hex or style
  bgGradient: string; // Tailwind bg-gradient
  stripeColor: string; // Pattern color
  startBpm: number;
  jingleType: 'laugh' | 'unlock' | 'success' | 'speedup';
  gamePool: string[]; // List of microgames they host
  avatarEmoji: string;
  moodEmojis: {
    idle: string;
    win: string;
    lose: string;
    ready: string;
  };
}

export const CHARACTERS: MascotCharacter[] = [
  {
    id: 'wario',
    name: 'Wario',
    tagline: 'The Greedy Founder',
    desc: 'Classic fast-paced microgames. Expect the unexpected! Watch out for his flatulence!',
    themeColor: 'from-yellow-400 to-purple-600',
    accentColor: '#eab308',
    bgGradient: 'bg-gradient-to-br from-yellow-400 via-amber-500 to-purple-800',
    stripeColor: 'rgba(234, 179, 8, 0.2)',
    startBpm: 125,
    jingleType: 'laugh',
    gamePool: ['crazy_cars', 'avoid_poop', 'chop_log'],
    avatarEmoji: '⚡',
    moodEmojis: {
      idle: '😈',
      win: '🤑',
      lose: '🤬',
      ready: '🔥'
    }
  },
  {
    id: 'ninevolt',
    name: '9-Volt',
    tagline: 'NES Retro Fanatic',
    desc: 'Nintendo 8-bit classics! Stomp enemies and match shapes from your favorite retro console.',
    themeColor: 'from-blue-500 to-red-500',
    accentColor: '#3b82f6',
    bgGradient: 'bg-gradient-to-br from-blue-600 via-indigo-800 to-red-600',
    stripeColor: 'rgba(59, 130, 246, 0.25)',
    startBpm: 135,
    jingleType: 'unlock',
    gamePool: ['stomp_enemies', 'match_shape', 'chop_log'],
    avatarEmoji: '🎮',
    moodEmojis: {
      idle: '😎',
      win: '👾',
      lose: '😭',
      ready: '⚔️'
    }
  },
  {
    id: 'ashley',
    name: 'Ashley',
    tagline: 'The Spooky Witch',
    desc: 'Spooky magic and quick reactions. Keep your eye on the cauldron and catch the toast!',
    themeColor: 'from-red-600 to-slate-900',
    accentColor: '#dc2626',
    bgGradient: 'bg-gradient-to-br from-red-700 via-rose-950 to-slate-900',
    stripeColor: 'rgba(220, 38, 38, 0.2)',
    startBpm: 120,
    jingleType: 'success',
    gamePool: ['catch_toast', 'avoid_poop', 'match_shape'],
    avatarEmoji: '🔮',
    moodEmojis: {
      idle: '💀',
      win: '🧙‍♀️',
      lose: '🗯️',
      ready: '🦇'
    }
  },
  {
    id: 'jimmy',
    name: 'Jimmy T.',
    tagline: 'Disco Superstar',
    desc: 'Rhythmic, high-speed beats. Keep the plate balanced and dance in perfect timing!',
    themeColor: 'from-pink-500 to-cyan-500',
    accentColor: '#ec4899',
    bgGradient: 'bg-gradient-to-br from-pink-500 via-purple-700 to-cyan-800',
    stripeColor: 'rgba(236, 72, 153, 0.25)',
    startBpm: 140,
    jingleType: 'speedup',
    gamePool: ['balance_plate', 'crazy_cars', 'chop_log'],
    avatarEmoji: '🕺',
    moodEmojis: {
      idle: '🕺',
      win: '✨',
      lose: '💔',
      ready: '🎧'
    }
  },
  {
    id: 'orbulon',
    name: 'Orbulon',
    tagline: '300-IQ Alien',
    desc: 'High-IQ brain teasers! Features DOUBLE-LENGTH (16 beats) microgames to unlock safes.',
    themeColor: 'from-teal-400 to-indigo-900',
    accentColor: '#14b8a6',
    bgGradient: 'bg-gradient-to-br from-teal-400 via-emerald-600 to-indigo-950',
    stripeColor: 'rgba(20, 184, 166, 0.2)',
    startBpm: 110,
    jingleType: 'unlock',
    gamePool: ['unlock_safe', 'match_shape', 'balance_plate'],
    avatarEmoji: '👽',
    moodEmojis: {
      idle: '🛸',
      win: '🧠',
      lose: '💥',
      ready: '📡'
    }
  }
];

export interface MicrogameDef {
  id: string;
  name: string;
  command: string;
  desc: string;
  controls: string;
  isDoubleLength?: boolean;
}

export const MICROGAMES: MicrogameDef[] = [
  {
    id: 'crazy_cars',
    name: 'Crazy Cars',
    command: 'DODGE!',
    desc: 'A wild pixel car speeds at you. Jump over it at the right microsecond! Watch out for sudden braking or fake-outs at high difficulty levels.',
    controls: 'SPACE BAR to JUMP',
    isDoubleLength: false
  },
  {
    id: 'stomp_enemies',
    name: 'Stomp Enemies',
    command: 'STOMP!',
    desc: 'Classic NES stomper. Move left and right and stomp all Goombas before they touch you or time runs out!',
    controls: 'ARROW KEYS to MOVE, SPACE BAR to JUMP',
    isDoubleLength: false
  },
  {
    id: 'unlock_safe',
    name: 'Unlock Safe',
    command: 'UNLOCK!',
    desc: 'Double-length brain puzzle. Spin the dial Left and Right matching the combination arrows to unlock the space vault of galactic treasures!',
    controls: 'LEFT / RIGHT ARROWS to ROTATE DIAL',
    isDoubleLength: true
  },
  {
    id: 'balance_plate',
    name: 'Balance Plate',
    command: 'BALANCE!',
    desc: 'A plate spins on a tall bamboo stick. Fine-tune your angles to combat high winds and slippery physics, keeping the plate balanced!',
    controls: 'LEFT / RIGHT ARROWS to TILT STICK',
    isDoubleLength: false
  },
  {
    id: 'chop_log',
    name: 'Chop Log',
    command: 'CHOP!',
    desc: 'Woodcutter speed test. Press space at the exact microsecond the rolling log aligns under your heavy axe to chop it perfectly!',
    controls: 'SPACE BAR to CHOP AXE',
    isDoubleLength: false
  },
  {
    id: 'catch_toast',
    name: 'Catch Toast',
    command: 'CATCH!',
    desc: 'High-tension toaster game. Wait for the toaster to click and pop, then grab the toast immediately! Be careful of steam shakes and fake-outs.',
    controls: 'SPACE BAR to SLAM HAND',
    isDoubleLength: false
  },
  {
    id: 'avoid_poop',
    name: 'Avoid Poop',
    command: 'AVOID!',
    desc: 'The skies are falling! Maneuver your character left and right to dodge falling objects (and smelly poops!) descending at speed.',
    controls: 'LEFT / RIGHT ARROWS to RUN',
    isDoubleLength: false
  },
  {
    id: 'match_shape',
    name: 'Match Shape',
    command: 'MATCH!',
    desc: 'Fast-paced mental match. Scan the grid and select the card that exactly matches the shape and color of the center target!',
    controls: 'ARROW KEYS to CURSOR, SPACE BAR to SELECT',
    isDoubleLength: false
  },
  {
    id: 'boss_game',
    name: 'Astro Mech',
    command: 'DEFEAT WARIO!',
    desc: 'STAGE BOSS GAME! Steer your ship and shoot missiles to defeat the giant mechanical Wario head while dodging his rain of fireballs.',
    controls: 'LEFT / RIGHT ARROWS to STEER, SPACE to SHOOT',
    isDoubleLength: true
  }
];
