import React, { useRef, useEffect } from 'react';
import { sound } from '../utils/soundEngine';

interface MicrogameRendererProps {
  gameId: string;
  difficulty: number; // 1, 2, or 3
  tempo: number; // Current BPM
  beatIndex: number; // Current beat of the microgame (0 to 8, or 0 to 16 for double length)
  isActive: boolean;
  keysPressed: { [key: string]: boolean };
  onWin: (clearBeat: number) => void;
  onLose: () => void;
}

export const MicrogameRenderer: React.FC<MicrogameRendererProps> = ({
  gameId,
  difficulty,
  tempo,
  beatIndex,
  isActive,
  keysPressed,
  onWin,
  onLose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<any>({});
  const hasTriggeredEnd = useRef<boolean>(false);

  // Initialize and Reset Game States when GameId, Difficulty, or Reset changes
  useEffect(() => {
    hasTriggeredEnd.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set initial custom state based on gameId
    const state: any = {
      time: 0,
      isCleared: false,
      isFailed: false,
      playerX: 200,
      playerY: 240,
      playerVy: 0,
      playerVx: 0,
      isOnGround: true,
      particles: [] as Array<{ x: number; y: number; vx: number; vy: number; color: string; size: number; alpha: number; life: number }>,
    };

    // Helper to spawn splash particles
    state.spawnParticles = (x: number, y: number, color: string, count: number = 8) => {
      for (let i = 0; i < count; i++) {
        state.particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6 - 2,
          color,
          size: 2 + Math.random() * 4,
          alpha: 1,
          life: 1.0,
        });
      }
    };

    switch (gameId) {
      case 'crazy_cars':
        state.playerX = 60;
        state.playerY = 220; // Standing on ground y=220
        state.playerVy = 0;
        state.isOnGround = true;
        // Car setup
        state.carX = 420;
        state.carY = 212;
        state.carWidth = 45;
        state.carHeight = 28;
        state.carSpeed = 4.5 + difficulty * 1.5;
        state.carState = 'drive'; // 'drive', 'stop', 'speedup', 'jump'
        state.carTimer = 0;
        state.hasJumpedOver = false;

        if (difficulty === 2) {
          state.carSpeed = 6.0;
        } else if (difficulty === 3) {
          state.carSpeed = 7.5;
          state.carState = 'drive';
        }
        break;

      case 'stomp_enemies':
        state.playerX = 200;
        state.playerY = 220;
        state.playerVy = 0;
        state.isOnGround = true;
        // Enemies (Goombas)
        state.enemies = [] as Array<{ x: number; y: number; vx: number; isDead: boolean; size: number }>;
        const count = difficulty === 1 ? 1 : difficulty === 2 ? 2 : 3;
        for (let i = 0; i < count; i++) {
          state.enemies.push({
            x: 80 + i * 110 + Math.random() * 40,
            y: 228,
            vx: (difficulty === 1 ? 1.2 : difficulty === 2 ? 1.8 : 2.5) * (i % 2 === 0 ? 1 : -1),
            isDead: false,
            size: 24,
          });
        }
        break;

      case 'unlock_safe':
        state.dialRotation = 0; // in degrees
        state.ticks = 0;
        state.lastTickRot = 0;
        state.comboStep = 0;

        // Generate combinations
        if (difficulty === 1) {
          state.combo = [
            { dir: 'L', notches: 4, hit: false, label: '4 ◀' }
          ];
        } else if (difficulty === 2) {
          state.combo = [
            { dir: 'L', notches: 4, hit: false, label: '4 ◀' },
            { dir: 'R', notches: 3, hit: false, label: '3 ▶' }
          ];
        } else {
          state.combo = [
            { dir: 'L', notches: 3, hit: false, label: '3 ◀' },
            { dir: 'R', notches: 4, hit: false, label: '4 ▶' },
            { dir: 'L', notches: 2, hit: false, label: '2 ◀' }
          ];
        }
        state.currentNotchCount = 0;
        state.lastArrowDir = null; // Track current turn direction
        break;

      case 'balance_plate':
        state.stickAngle = 0; // in radians
        state.stickVx = 0;
        state.plateX = 0; // offset from center of stick top
        state.plateVx = 0;
        state.plateY = 110; // offset relative to stick tip
        state.isFallen = false;
        break;

      case 'chop_log':
        state.logX = 420;
        state.logY = 210;
        state.logSpeed = 3.5 + difficulty * 1.5;
        state.logWidth = difficulty === 1 ? 42 : difficulty === 2 ? 30 : 20;
        state.axeAngle = -Math.PI / 4; // Angled back
        state.axeState = 'ready'; // 'ready', 'swing', 'hit', 'miss'
        state.axeTimer = 0;
        break;

      case 'catch_toast':
        state.toastY = 220;
        state.toastVy = 0;
        state.toastState = 'idle'; // 'idle', 'shake', 'pop', 'caught', 'dropped'
        // Decide pop beat (randomly between beat 2 and 5)
        state.popBeat = 2.5 + Math.random() * 2.5;
        state.popTimer = 0;
        state.handY = 60;
        state.handState = 'ready'; // 'ready', 'slam', 'hold', 'miss'
        state.handTimer = 0;
        state.faking = difficulty === 3 && Math.random() > 0.4;
        state.hasFaked = false;
        break;

      case 'avoid_poop':
        state.playerX = 200;
        state.playerY = 230;
        // Poops list
        state.poops = [] as Array<{ x: number; y: number; vy: number; size: number; type: 'poop' | 'rock' }>;
        const poopCount = difficulty === 1 ? 2 : difficulty === 2 ? 4 : 6;
        for (let i = 0; i < poopCount; i++) {
          state.poops.push({
            x: 40 + Math.random() * 320,
            y: -20 - Math.random() * 120,
            vy: (1.8 + Math.random() * 2 + difficulty * 0.8),
            size: 16 + Math.random() * 8,
            type: Math.random() > 0.4 ? 'poop' : 'rock',
          });
        }
        break;

      case 'match_shape':
        state.selectedIdx = 0;
        state.maxCards = difficulty === 1 ? 2 : 3;

        // Colors and shapes definitions
        const shapes = ['circle', 'square', 'triangle', 'star'];
        const colors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308']; // Red, Blue, Green, Yellow

        // Create random targets
        state.cards = [] as Array<{ shape: string; color: string; id: number }>;
        for (let i = 0; i < state.maxCards; i++) {
          // ensure cards are unique
          let shape = shapes[Math.floor(Math.random() * shapes.length)];
          let color = colors[Math.floor(Math.random() * colors.length)];
          while (state.cards.some((c: any) => c.shape === shape && c.color === color)) {
            shape = shapes[Math.floor(Math.random() * shapes.length)];
            color = colors[Math.floor(Math.random() * colors.length)];
          }
          state.cards.push({ shape, color, id: i });
        }

        // Target is one of the cards
        const targetCard = state.cards[Math.floor(Math.random() * state.cards.length)];
        state.targetShape = targetCard.shape;
        state.targetColor = targetCard.color;
        break;

      case 'boss_game':
        // Astro Mech
        state.playerX = 200;
        state.playerY = 250;
        state.playerHp = 3;
        state.laserCooldown = 0;
        state.lasers = [] as Array<{ x: number; y: number; vy: number }>;

        state.bossX = 200;
        state.bossY = 50;
        state.bossVx = 2;
        state.bossHp = 5 + (difficulty - 1) * 2;
        state.bossMaxHp = state.bossHp;
        state.bossFlash = 0;
        state.bossProjectiles = [] as Array<{ x: number; y: number; vx: number; vy: number }>;
        state.bossShootTimer = 0;
        break;

      default:
        break;
    }

    stateRef.current = state;
  }, [gameId, difficulty]);

  // Main Loop
  useEffect(() => {
    let animationFrameId: number;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      if (!isActive) {
        animationFrameId = requestAnimationFrame(loop);
        return;
      }

      const state = stateRef.current;
      state.time += 1;

      // Handle custom physics & updates per gameId
      updatePhysics(state);

      // Render Everything
      renderCanvas(ctx, state);

      // Check results and trigger win/lose exactly once
      if (!hasTriggeredEnd.current) {
        if (state.isCleared) {
          hasTriggeredEnd.current = true;
          // Calculate the beat of success
          // Current total beats elapsed in this game is (beatIndex + frame/beats_per_frame)
          // To be simple, we pass the current beatIndex + fraction
          const clearBeat = beatIndex + (state.time % (60 / (tempo / 60))) / (60 / (tempo / 60));
          sound.playSFX('success');
          onWin(Math.min(16, Math.max(1, Math.round(clearBeat * 10) / 10)));
        } else if (state.isFailed) {
          hasTriggeredEnd.current = true;
          sound.playSFX('failure');
          onLose();
        }
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isActive, gameId, difficulty, beatIndex, tempo, onWin, onLose]);

  // Handle key triggers (like single clicks that shouldn't repeat)
  useEffect(() => {
    if (!isActive) return;
    const state = stateRef.current;

    // Handle space presses or arrow keys as single triggers
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        onSpacePress(state);
      }
      if (e.code === 'ArrowLeft') {
        onArrowPress(state, 'L');
      }
      if (e.code === 'ArrowRight') {
        onArrowPress(state, 'R');
      }
      if (e.code === 'ArrowUp') {
        onArrowPress(state, 'U');
      }
      if (e.code === 'ArrowDown') {
        onArrowPress(state, 'D');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, gameId]);

  // Single Action Triggers
  const onSpacePress = (state: any) => {
    if (state.isCleared || state.isFailed) return;

    if (gameId === 'crazy_cars') {
      if (state.isOnGround) {
        state.playerVy = -11;
        state.isOnGround = false;
        sound.playSFX('jump');
      }
    } else if (gameId === 'stomp_enemies') {
      if (state.isOnGround) {
        state.playerVy = -10.5;
        state.isOnGround = false;
        sound.playSFX('jump');
      }
    } else if (gameId === 'chop_log') {
      if (state.axeState === 'ready') {
        state.axeState = 'swing';
        state.axeTimer = 0;
        sound.playSFX('click');
      }
    } else if (gameId === 'catch_toast') {
      if (state.handState === 'ready') {
        state.handState = 'slam';
        state.handTimer = 0;
        sound.playSFX('stomp');
      }
    } else if (gameId === 'match_shape') {
      // Validate Card Selection
      const selectedCard = state.cards[state.selectedIdx];
      if (selectedCard && selectedCard.shape === state.targetShape && selectedCard.color === state.targetColor) {
        state.isCleared = true;
        state.spawnParticles(80 + state.selectedIdx * 120, 220, state.targetColor, 15);
      } else {
        state.isFailed = true;
      }
    }
  };

  const onArrowPress = (state: any, dir: 'L' | 'R' | 'U' | 'D') => {
    if (state.isCleared || state.isFailed) return;

    if (gameId === 'match_shape') {
      sound.playSFX('click');
      if (dir === 'L') {
        state.selectedIdx = Math.max(0, state.selectedIdx - 1);
      } else if (dir === 'R') {
        state.selectedIdx = Math.min(state.maxCards - 1, state.selectedIdx + 1);
      }
    }
  };

  // PHYSICS UPDATER
  const updatePhysics = (state: any) => {
    // Standard particles decay
    state.particles.forEach((p: any) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // particle gravity
      p.life -= 0.02;
      p.alpha = Math.max(0, p.life);
    });
    state.particles = state.particles.filter((p: any) => p.life > 0);

    switch (gameId) {
      case 'crazy_cars': {
        // Player Gravity
        if (!state.isOnGround) {
          state.playerY += state.playerVy;
          state.playerVy += 0.55; // gravity
          if (state.playerY >= 220) {
            state.playerY = 220;
            state.playerVy = 0;
            state.isOnGround = true;
          }
        }

        // Move Car
        if (state.carState === 'drive') {
          state.carX -= state.carSpeed;

          // Sudden Stop Gimmick for Level 2
          if (difficulty === 2 && state.carX <= 230 && state.carX >= 210) {
            state.carState = 'stop';
            state.carTimer = 22; // Stop for 22 frames
          }
          // Jump Gimmick for Level 3
          if (difficulty === 3 && state.carX <= 240 && state.carX >= 220 && !state.hasJumpedOver) {
            state.carState = 'jump';
            state.carVy = -6;
          }
        } else if (state.carState === 'stop') {
          state.carTimer--;
          if (state.carTimer <= 0) {
            state.carState = 'drive';
            state.carSpeed = 11.0; // Zoom super fast now!
          }
        } else if (state.carState === 'jump') {
          state.carX -= state.carSpeed;
          state.carY += state.carVy;
          state.carVy += 0.4;
          if (state.carY >= 212) {
            state.carY = 212;
            state.carState = 'drive';
            state.hasJumpedOver = true;
          }
        }

        // Check collision
        const playerBox = { x: state.playerX, y: state.playerY - 28, w: 22, h: 28 };
        const carBox = { x: state.carX, y: state.carY - 4, w: state.carWidth, h: state.carHeight };

        const isColliding =
          playerBox.x < carBox.x + carBox.w &&
          playerBox.x + playerBox.w > carBox.x &&
          playerBox.y < carBox.y + carBox.h &&
          playerBox.y + playerBox.h > carBox.y;

        if (isColliding && !state.isCleared && !state.isFailed) {
          state.isFailed = true;
          state.spawnParticles(state.playerX + 11, state.playerY - 14, '#ef4444', 12);
        }

        // Win condition: Car is past the player and gone
        if (state.carX < -50 && !state.isFailed) {
          state.isCleared = true;
        }
        break;
      }

      case 'stomp_enemies': {
        // Player Move
        if (keysPressed['ArrowLeft']) {
          state.playerX = Math.max(30, state.playerX - 4.5);
        }
        if (keysPressed['ArrowRight']) {
          state.playerX = Math.min(370, state.playerX + 4.5);
        }

        // Player Jump Physics
        if (!state.isOnGround) {
          state.playerY += state.playerVy;
          state.playerVy += 0.5;
          if (state.playerY >= 220) {
            state.playerY = 220;
            state.playerVy = 0;
            state.isOnGround = true;
          }
        }

        let allDead = true;
        const pBox = { x: state.playerX, y: state.playerY, w: 24, h: 32 };

        state.enemies.forEach((enemy: any) => {
          if (enemy.isDead) return;
          allDead = false;

          // Move enemy
          enemy.x += enemy.vx;
          if (enemy.x <= 40 || enemy.x >= 360) {
            enemy.vx *= -1;
          }

          // Collide Box
          const eBox = { x: enemy.x - 12, y: enemy.y - 12, w: 24, h: 24 };

          const isOverlapping =
            pBox.x - 12 < eBox.x + eBox.w &&
            pBox.x + 12 > eBox.x &&
            pBox.y - 32 < eBox.y + eBox.h &&
            pBox.y > eBox.y;

          if (isOverlapping) {
            // Is player falling down on enemy head? (stomp)
            const isStomp = state.playerVy > 0 && pBox.y <= eBox.y + 6;
            if (isStomp) {
              enemy.isDead = true;
              state.playerVy = -7.5; // Bounce up!
              sound.playSFX('stomp');
              state.spawnParticles(enemy.x, enemy.y, '#f59e0b', 8);
            } else {
              // Player takes hit
              state.isFailed = true;
              state.spawnParticles(pBox.x, pBox.y - 16, '#dc2626', 12);
            }
          }
        });

        if (allDead && state.enemies.length > 0 && !state.isFailed) {
          state.isCleared = true;
        }
        break;
      }

      case 'unlock_safe': {
        // Continuous rotation checks via key states
        const rotSpeed = 3.5;
        let rotationDelta = 0;

        if (keysPressed['ArrowLeft']) {
          state.dialRotation -= rotSpeed;
          rotationDelta = -rotSpeed;
          state.lastArrowDir = 'L';
        } else if (keysPressed['ArrowRight']) {
          state.dialRotation += rotSpeed;
          rotationDelta = rotSpeed;
          state.lastArrowDir = 'R';
        }

        // Ticking audio feed
        if (Math.abs(state.dialRotation - state.lastTickRot) >= 30) {
          sound.playSFX('click');
          state.lastTickRot = state.dialRotation;

          // Update tick count for combo
          const currentCombo = state.combo[state.comboStep];
          if (currentCombo && !currentCombo.hit) {
            const matchesDir =
              (currentCombo.dir === 'L' && rotationDelta < 0) ||
              (currentCombo.dir === 'R' && rotationDelta > 0);

            if (matchesDir) {
              state.currentNotchCount++;
              if (state.currentNotchCount >= currentCombo.notches) {
                // Step Completed!
                currentCombo.hit = true;
                state.comboStep++;
                state.currentNotchCount = 0;
                sound.playSFX('select');
                state.spawnParticles(200, 150, '#facc15', 12);

                if (state.comboStep >= state.combo.length) {
                  state.isCleared = true;
                }
              }
            } else {
              // Wrong direction penalty - reset progress of current step
              state.currentNotchCount = 0;
            }
          }
        }
        break;
      }

      case 'balance_plate': {
        // Continuous balancing angles
        const stickSpeed = 0.024;
        const autoGrav = 0.007;

        if (keysPressed['ArrowLeft']) {
          state.stickAngle -= stickSpeed;
        }
        if (keysPressed['ArrowRight']) {
          state.stickAngle += stickSpeed;
        }

        // Stick falls slightly on its own
        state.stickAngle += state.stickAngle * autoGrav;
        // Clamp angle
        state.stickAngle = Math.max(-0.55, Math.min(0.55, state.stickAngle));

        // Wind force
        const windPower = Math.sin(state.time * 0.04) * (0.015 * difficulty);
        state.stickAngle += windPower * 0.15;

        // Plate sliding physics
        state.plateVx += Math.sin(state.stickAngle) * 0.35 + windPower;
        state.plateVx *= 0.96; // friction
        state.plateX += state.plateVx;

        // Check fall conditions
        if (Math.abs(state.plateX) > 55) {
          state.isFallen = true;
          state.isFailed = true;
          state.spawnParticles(200 + state.plateX, 120, '#ef4444', 15);
        }

        // Survive condition is evaluated on parent timer completion
        break;
      }

      case 'chop_log': {
        if (state.axeState === 'ready') {
          // Log moves left
          state.logX -= state.logSpeed;

          // Auto-fail if log rolls past completely without chop attempt
          if (state.logX < 140) {
            state.axeState = 'miss';
            state.isFailed = true;
          }
        } else if (state.axeState === 'swing') {
          // Rapid swing rotation
          state.axeAngle += 0.28;
          if (state.axeAngle >= Math.PI / 2.5) {
            state.axeAngle = Math.PI / 2.5;

            // Check if log is in chop alignment!
            // Perfect chop range centered at 200
            const logCenter = state.logX + state.logWidth / 2;
            const targetX = 200;
            const tolerance = state.logWidth / 2 + 15;

            const inRange = Math.abs(logCenter - targetX) <= tolerance;

            if (inRange) {
              state.axeState = 'hit';
              state.isCleared = true;
              sound.playSFX('stomp');
              state.spawnParticles(targetX, 220, '#d97706', 15);
            } else {
              state.axeState = 'miss';
              state.isFailed = true;
              sound.playSFX('failure');
              state.spawnParticles(targetX, 240, '#6b7280', 8);
            }
          }
        }
        break;
      }

      case 'catch_toast': {
        // Ticking down to pop
        if (state.toastState === 'idle') {
          const currentBeatExact = state.time / (60 / (tempo / 60));

          // Toast shakes before pop
          if (currentBeatExact >= state.popBeat - 0.75) {
            state.toastState = 'shake';
          }
        }

        if (state.toastState === 'shake') {
          const currentBeatExact = state.time / (60 / (tempo / 60));

          if (state.faking && !state.hasFaked && currentBeatExact >= state.popBeat) {
            // Fakeout puff!
            state.toastState = 'idle';
            state.hasFaked = true;
            state.popBeat = currentBeatExact + 1.5; // Delay real pop
            sound.playSFX('click');
            state.spawnParticles(200, 190, '#cbd5e1', 6);
          } else if (currentBeatExact >= state.popBeat) {
            state.toastState = 'pop';
            state.toastVy = -11.5 - (difficulty * 0.8);
            sound.playSFX('jump');
          }
        }

        // Flying toast physics
        if (state.toastState === 'pop') {
          state.toastY += state.toastVy;
          state.toastVy += 0.45; // gravity

          if (state.toastY > 310) {
            state.toastState = 'dropped';
            state.isFailed = true;
          }
        }

        // Slamming Hand Animation
        if (state.handState === 'slam') {
          state.handY += 16;
          if (state.handY >= 140) {
            state.handY = 140;

            // Check capture overlap
            if (state.toastState === 'pop' && state.toastY >= 100 && state.toastY <= 170) {
              state.toastState = 'caught';
              state.handState = 'hold';
              state.isCleared = true;
              state.spawnParticles(200, 130, '#eab308', 12);
            } else {
              state.handState = 'miss';
              state.isFailed = true;
              state.spawnParticles(200, 140, '#374151', 6);
            }
          }
        } else if (state.handState === 'miss' || state.handState === 'hold') {
          // Keep hand in position
        }
        break;
      }

      case 'avoid_poop': {
        // Move Player
        if (keysPressed['ArrowLeft']) {
          state.playerX = Math.max(30, state.playerX - 5.5);
        }
        if (keysPressed['ArrowRight']) {
          state.playerX = Math.min(370, state.playerX + 5.5);
        }

        // Move Projectiles
        let hasHit = false;
        state.poops.forEach((poop: any) => {
          poop.y += poop.vy;

          // Screen wraps poops to keep it intense
          if (poop.y > 320) {
            poop.y = -30 - Math.random() * 40;
            poop.x = 40 + Math.random() * 320;
          }

          // Check hit
          const dist = Math.hypot(poop.x - state.playerX, poop.y - state.playerY);
          if (dist < poop.size / 2 + 14) {
            hasHit = true;
          }
        });

        if (hasHit && !state.isCleared && !state.isFailed) {
          state.isFailed = true;
          state.spawnParticles(state.playerX, state.playerY - 12, '#78350f', 15);
        }
        break;
      }

      case 'boss_game': {
        // Player controls
        if (keysPressed['ArrowLeft']) {
          state.playerX = Math.max(40, state.playerX - 5.0);
        }
        if (keysPressed['ArrowRight']) {
          state.playerX = Math.min(360, state.playerX + 5.0);
        }

        // Laser weapon cooldown and firing
        if (state.laserCooldown > 0) {
          state.laserCooldown--;
        }
        if (keysPressed['Space'] && state.laserCooldown === 0) {
          state.lasers.push({ x: state.playerX, y: state.playerY - 18, vy: -9 });
          state.laserCooldown = 11;
          sound.playSFX('click');
        }

        // Update player lasers
        state.lasers.forEach((l: any) => {
          l.y += l.vy;
        });
        state.lasers = state.lasers.filter((l: any) => l.y > -20);

        // Boss move logic
        state.bossX += state.bossVx;
        if (state.bossX < 80 || state.bossX > 320) {
          state.bossVx *= -1;
        }

        if (state.bossFlash > 0) state.bossFlash--;

        // Boss attacks
        state.bossShootTimer += 1.0 + (difficulty * 0.25);
        if (state.bossShootTimer >= 60) {
          state.bossShootTimer = 0;
          // Fire fireballs
          state.bossProjectiles.push({
            x: state.bossX,
            y: state.bossY + 20,
            vx: -1.5 + Math.random() * 3,
            vy: 3.5 + difficulty * 0.7,
          });
          sound.playSFX('jump');
        }

        // Update Boss projectiles
        state.bossProjectiles.forEach((p: any) => {
          p.x += p.vx;
          p.y += p.vy;
        });
        state.bossProjectiles = state.bossProjectiles.filter((p: any) => p.y < 320);

        // Collision: Laser hits Boss
        state.lasers.forEach((l: any) => {
          const dist = Math.hypot(l.x - state.bossX, l.y - state.bossY);
          if (dist < 32) {
            // hit!
            l.y = -100; // discard
            state.bossHp--;
            state.bossFlash = 10;
            sound.playSFX('stomp');
            state.spawnParticles(state.bossX, state.bossY + 10, '#ef4444', 8);

            if (state.bossHp <= 0) {
              state.isCleared = true;
              state.spawnParticles(state.bossX, state.bossY, '#facc15', 30);
            }
          }
        });

        // Collision: Projectile hits Player
        state.bossProjectiles.forEach((p: any) => {
          const dist = Math.hypot(p.x - state.playerX, p.y - state.playerY);
          if (dist < 18) {
            p.y = 400; // discard
            state.playerHp--;
            sound.playSFX('failure');
            state.spawnParticles(state.playerX, state.playerY, '#ef4444', 10);

            if (state.playerHp <= 0) {
              state.isFailed = true;
            }
          }
        });
        break;
      }

      default:
        break;
    }
  };

  // CANVAS RENDERER
  const renderCanvas = (ctx: CanvasRenderingContext2D, state: any) => {
    // Clear
    ctx.fillStyle = '#0f172a'; // slate 900
    ctx.fillRect(0, 0, 400, 300);

    // Draw background grid lines for aesthetic
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.15)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 400; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 300);
      ctx.stroke();
    }
    for (let y = 0; y < 300; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(400, y);
      ctx.stroke();
    }

    // DRAW STAGE-SPECIFIC GRAPHICS
    switch (gameId) {
      case 'crazy_cars': {
        // Ground
        ctx.fillStyle = '#475569';
        ctx.fillRect(0, 220, 400, 80);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(0, 220, 400, 4);

        // Player (Wario emoji or custom retro draw)
        ctx.save();
        ctx.translate(state.playerX + 11, state.playerY);
        if (state.isFailed) {
          // Squished player flat
          ctx.scale(1.8, 0.15);
        }
        ctx.font = '28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('😈', 0, 4);
        ctx.restore();

        // Skateboard below player
        if (state.isOnGround && !state.isFailed) {
          ctx.fillStyle = '#a855f7';
          ctx.fillRect(state.playerX - 2, state.playerY, 26, 4);
          ctx.fillStyle = '#1e1b4b';
          ctx.beginPath();
          ctx.arc(state.playerX + 2, state.playerY + 6, 3, 0, Math.PI * 2);
          ctx.arc(state.playerX + 22, state.playerY + 6, 3, 0, Math.PI * 2);
          ctx.fill();
        }

        // Draw Car
        ctx.save();
        ctx.translate(state.carX, state.carY);
        // Car Body
        ctx.fillStyle = '#ef4444'; // Red car
        ctx.fillRect(0, 0, state.carWidth, state.carHeight - 6);
        // Cabin
        ctx.fillStyle = '#f87171';
        ctx.fillRect(8, -12, state.carWidth - 16, 12);
        // Windshield
        ctx.fillStyle = '#93c5fd';
        ctx.fillRect(4, -8, 8, 8);
        // Wheels
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(10, state.carHeight - 4, 7, 0, Math.PI * 2);
        ctx.arc(state.carWidth - 10, state.carHeight - 4, 7, 0, Math.PI * 2);
        ctx.fill();
        // Yellow Wheel Hubs
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.arc(10, state.carHeight - 4, 3, 0, Math.PI * 2);
        ctx.arc(state.carWidth - 10, state.carHeight - 4, 3, 0, Math.PI * 2);
        ctx.fill();

        // Car face/headlights
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(0, 8, 4, 6);
        ctx.restore();
        break;
      }

      case 'stomp_enemies': {
        // Ground
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 220, 400, 80);
        ctx.fillStyle = '#16a34a'; // Green grass top
        ctx.fillRect(0, 220, 400, 6);

        // Level text in background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.font = '72px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('NES', 200, 160);

        // Draw Player
        ctx.save();
        ctx.translate(state.playerX, state.playerY);
        ctx.font = '28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        if (state.isFailed) {
          ctx.fillText('😭', 0, 4);
        } else {
          ctx.fillText('🎮', 0, 4);
        }
        ctx.restore();

        // Draw Goombas (Enemies)
        state.enemies.forEach((enemy: any) => {
          ctx.save();
          ctx.translate(enemy.x, enemy.y);
          if (enemy.isDead) {
            ctx.scale(1.5, 0.15); // Flat stomp
          }
          ctx.font = '22px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText('👾', 0, 4);
          ctx.restore();
        });
        break;
      }

      case 'unlock_safe': {
        // Safe lock cabinet background
        ctx.fillStyle = '#334155'; // Grey steel background
        ctx.fillRect(50, 40, 300, 220);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 6;
        ctx.strokeRect(52, 42, 296, 216);

        // Draw Combo Instructions on the Safe door
        ctx.fillStyle = '#f8fafc';
        ctx.font = '12px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('COMBINATION LOCK', 200, 65);

        // Combo notches progress
        state.combo.forEach((c: any, idx: number) => {
          ctx.fillStyle = c.hit ? '#22c55e' : (idx === state.comboStep ? '#facc15' : '#64748b');
          ctx.font = '14px "Press Start 2P"';
          ctx.fillText(c.label, 130 + idx * 70, 95);

          if (idx === state.comboStep && !state.isCleared) {
            // Draw active arrow helper
            ctx.strokeStyle = '#facc15';
            ctx.strokeRect(105 + idx * 70, 78, 50, 22);
          }
        });

        // Combination dial wheel
        ctx.save();
        ctx.translate(200, 175);
        ctx.rotate((state.dialRotation * Math.PI) / 180);

        // Outer dial circle
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 60, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Dial numbers/notches indicators
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 2;
        for (let i = 0; i < 12; i++) {
          ctx.rotate(Math.PI / 6);
          ctx.beginPath();
          ctx.moveTo(0, -50);
          ctx.lineTo(0, -58);
          ctx.stroke();
        }

        // Inner knob
        ctx.fillStyle = '#475569';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 32, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Pointer knob line
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -28);
        ctx.stroke();

        ctx.restore();

        // Dial center pointer marker
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(200, 102);
        ctx.lineTo(195, 95);
        ctx.lineTo(205, 95);
        ctx.closePath();
        ctx.fill();

        // Unlock glow!
        if (state.isCleared) {
          ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
          ctx.fillRect(52, 42, 296, 216);
          ctx.fillStyle = '#22c55e';
          ctx.font = '20px "Press Start 2P"';
          ctx.fillText('UNLOCKED!', 200, 180);
        }
        break;
      }

      case 'balance_plate': {
        // Ground / Stand
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 260, 400, 40);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(180, 250, 40, 10);

        // Bamboo pole drawing
        ctx.save();
        ctx.translate(200, 250);
        ctx.rotate(state.stickAngle);

        ctx.strokeStyle = '#84cc16'; // bamboo green
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -130);
        ctx.stroke();

        // Bamboo rings
        ctx.fillStyle = '#4d7c0f';
        for (let i = 20; i < 130; i += 30) {
          ctx.fillRect(-4, -i, 8, 3);
        }

        // Balance tip point
        ctx.fillStyle = '#a855f7';
        ctx.beginPath();
        ctx.arc(0, -130, 5, 0, Math.PI * 2);
        ctx.fill();

        // Draw Plate sitting on top of stick with offsets
        ctx.translate(state.plateX, -130);
        if (!state.isFallen) {
          // Plate shadow
          ctx.fillStyle = 'rgba(0,0,0,0.15)';
          ctx.beginPath();
          ctx.ellipse(0, 6, 24, 4, 0, 0, Math.PI * 2);
          ctx.fill();

          // Plate Rim (Porcelain white/blue)
          ctx.fillStyle = '#f8fafc';
          ctx.strokeStyle = '#2563eb';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(0, 0, 26, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Plate Center lines
          ctx.strokeStyle = '#60a5fa';
          ctx.beginPath();
          ctx.ellipse(0, 0, 14, 3, 0, 0, Math.PI * 2);
          ctx.stroke();

          // Sparkle balancing effect
          if (Math.abs(state.plateX) < 12 && state.time % 10 < 5) {
            ctx.fillStyle = '#facc15';
            ctx.font = '10px "Press Start 2P"';
            ctx.fillText('✨', -15, -12);
          }
        }
        ctx.restore();

        // If plate is fallen, draw it smashed on the ground
        if (state.isFallen) {
          ctx.fillStyle = '#cbd5e1';
          ctx.strokeStyle = '#2563eb';
          ctx.lineWidth = 2.5;

          // Shards scattered
          ctx.beginPath();
          ctx.moveTo(160, 255);
          ctx.lineTo(168, 251);
          ctx.lineTo(172, 256);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(230, 257);
          ctx.lineTo(238, 253);
          ctx.lineTo(235, 258);
          ctx.stroke();

          ctx.font = '24px sans-serif';
          ctx.fillText('💔', 188, 240);
        }
        break;
      }

      case 'chop_log': {
        // Conveyor belt road
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 220, 400, 80);
        ctx.fillStyle = '#334155';
        ctx.fillRect(0, 220, 400, 4);

        // Yellow dashes on road
        ctx.fillStyle = '#eab308';
        for (let i = (state.time * 2.5) % 80; i < 400; i += 80) {
          ctx.fillRect(400 - i, 235, 20, 3);
        }

        // Target cut indicator zone
        ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
        ctx.fillRect(200 - state.logWidth / 2 - 10, 210, state.logWidth + 20, 20);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(200 - state.logWidth / 2 - 10, 210, state.logWidth + 20, 20);

        // Draw Log
        if (state.axeState !== 'hit') {
          // Circular wood pattern log rolling
          ctx.save();
          ctx.translate(state.logX + state.logWidth / 2, state.logY + 12);
          ctx.rotate((-state.logX / 15) % (Math.PI * 2));

          // Log Body
          ctx.fillStyle = '#d97706'; // Wood brown
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, state.logWidth / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Bark Rings
          ctx.strokeStyle = '#b45309';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, state.logWidth / 3, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, state.logWidth / 5, 0, Math.PI * 2);
          ctx.stroke();

          ctx.restore();
        } else {
          // Smashed wood halves flying apart
          ctx.fillStyle = '#d97706';
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 3;

          // Half Left
          ctx.beginPath();
          ctx.arc(200 - 15, state.logY + 12, state.logWidth / 2, Math.PI / 2, (Math.PI * 3) / 2);
          ctx.lineTo(200 - 15, state.logY + 12 + state.logWidth / 2);
          ctx.fill();
          ctx.stroke();

          // Half Right
          ctx.beginPath();
          ctx.arc(200 + 15, state.logY + 12, state.logWidth / 2, (Math.PI * 3) / 2, Math.PI / 2);
          ctx.lineTo(200 + 15, state.logY + 12 - state.logWidth / 2);
          ctx.fill();
          ctx.stroke();
        }

        // Draw Axe
        ctx.save();
        ctx.translate(200, 100);
        ctx.rotate(state.axeAngle);

        // Wooden handle
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 110);
        ctx.stroke();

        // Metallic Blade
        ctx.fillStyle = '#94a3b8';
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-15, 90);
        ctx.lineTo(15, 80);
        ctx.lineTo(22, 105);
        ctx.lineTo(-8, 110);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
        break;
      }

      case 'catch_toast': {
        // Spooky brick background
        ctx.fillStyle = '#1e1b4b'; // deep indigo
        ctx.fillRect(0, 0, 400, 300);

        // Spooky Oven/Toaster centered
        ctx.fillStyle = '#475569';
        ctx.fillRect(150, 180, 100, 75);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 4;
        ctx.strokeRect(152, 182, 96, 71);

        // Toaster face / teeth
        ctx.fillStyle = '#ef4444'; // red evil eyes
        ctx.beginPath();
        ctx.arc(175, 205, 5, 0, Math.PI * 2);
        ctx.arc(225, 205, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(170, 225);
        ctx.lineTo(230, 225);
        ctx.stroke();

        // Steam shake effect
        if (state.toastState === 'shake' || (state.faking && !state.hasFaked && state.time % 20 < 10)) {
          // Draw heat steam squiggles
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
          ctx.lineWidth = 3;
          const shakeOffset = Math.sin(state.time * 0.8) * 3;
          ctx.beginPath();
          ctx.moveTo(180 + shakeOffset, 175);
          ctx.lineTo(183 + shakeOffset, 165);
          ctx.moveTo(220 + shakeOffset, 175);
          ctx.lineTo(217 + shakeOffset, 165);
          ctx.stroke();
        }

        // Draw Toast
        if (state.toastState !== 'caught') {
          ctx.save();
          ctx.translate(200, state.toastY);
          // Toast body
          ctx.fillStyle = '#f59e0b';
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.roundRect(-16, -16, 32, 32, [6]);
          ctx.fill();
          ctx.stroke();

          // Smiley on toast
          ctx.fillStyle = '#78350f';
          ctx.beginPath();
          ctx.arc(-5, -4, 2, 0, Math.PI * 2);
          ctx.arc(5, -4, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(0, 4, 4, 0, Math.PI);
          ctx.stroke();

          ctx.restore();
        }

        // Draw catching Hand
        ctx.save();
        ctx.translate(200, state.handY);

        // Hand Arm
        ctx.strokeStyle = '#fca5a5'; // pale pink flesh arm
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(0, -60);
        ctx.lineTo(0, 0);
        ctx.stroke();

        // Claw / glove fist
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 5, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Fingers closed if caught
        ctx.fillStyle = '#e2e8f0';
        if (state.toastState === 'caught') {
          // Toast grabbed inside glove
          ctx.save();
          ctx.translate(0, 10);
          ctx.fillStyle = '#f59e0b';
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(-12, -12, 24, 24, [4]);
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          // fingers wrapped
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(-8, 12, 5, 0, Math.PI * 2);
          ctx.arc(0, 14, 5, 0, Math.PI * 2);
          ctx.arc(8, 12, 5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Open hand claw
          ctx.beginPath();
          ctx.arc(-14, 8, 4, 0, Math.PI * 2);
          ctx.arc(14, 8, 4, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
        break;
      }

      case 'avoid_poop': {
        // City skyscraper skyline outline background
        ctx.fillStyle = '#334155';
        ctx.fillRect(40, 160, 50, 80);
        ctx.fillRect(110, 130, 60, 110);
        ctx.fillRect(210, 170, 70, 70);
        ctx.fillRect(300, 140, 55, 100);

        // Ground
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 240, 400, 60);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(0, 240, 400, 4);

        // Draw Player with Umbrella!
        ctx.save();
        ctx.translate(state.playerX, state.playerY);
        ctx.font = '28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        if (state.isFailed) {
          ctx.fillText('💩', 0, 4); // Failed, head full of poop
        } else {
          ctx.fillText('🏃', 0, 4); // Run emoji
        }

        // Umbrella
        if (!state.isFailed) {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(0, -22);
          ctx.lineTo(0, -38);
          ctx.stroke();

          // Canopy
          ctx.fillStyle = '#f87171';
          ctx.beginPath();
          ctx.arc(0, -38, 16, Math.PI, 0);
          ctx.fill();
        }
        ctx.restore();

        // Draw falling elements
        state.poops.forEach((poop: any) => {
          ctx.save();
          ctx.translate(poop.x, poop.y);
          ctx.font = `${poop.size}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(poop.type === 'poop' ? '💩' : '🪨', 0, 0);
          ctx.restore();
        });
        break;
      }

      case 'match_shape': {
        // Target Box
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#eab308'; // glowing gold
        ctx.lineWidth = 4;
        ctx.strokeRect(148, 28, 104, 84);
        ctx.fillRect(150, 30, 100, 80);

        ctx.fillStyle = '#eab308';
        ctx.font = '9px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('TARGET', 200, 45);

        // Draw Target Shape
        drawCardContent(ctx, 200, 78, state.targetShape, state.targetColor);

        // Pedestals & Cards
        for (let i = 0; i < state.maxCards; i++) {
          const cardX = 80 + i * 120;
          const cardY = 200;

          // Pedestal stand
          ctx.fillStyle = '#475569';
          ctx.fillRect(cardX - 45, cardY + 30, 90, 15);
          ctx.fillStyle = '#334155';
          ctx.fillRect(cardX - 10, cardY + 5, 20, 25);

          // Card Background
          ctx.fillStyle = '#f8fafc';
          ctx.strokeStyle = state.selectedIdx === i ? '#ec4899' : '#475569';
          ctx.lineWidth = state.selectedIdx === i ? 4 : 2;
          ctx.beginPath();
          ctx.roundRect(cardX - 35, cardY - 45, 70, 70, [6]);
          ctx.fill();
          ctx.stroke();

          // Card shape
          const card = state.cards[i];
          if (card) {
            drawCardContent(ctx, cardX, cardY - 10, card.shape, card.color);
          }

          // Cursor Arrow above card
          if (state.selectedIdx === i && !state.isCleared && !state.isFailed) {
            ctx.fillStyle = '#ec4899';
            ctx.beginPath();
            ctx.moveTo(cardX, cardY - 65);
            ctx.lineTo(cardX - 8, cardY - 75);
            ctx.lineTo(cardX + 8, cardY - 75);
            ctx.closePath();
            ctx.fill();
          }
        }
        break;
      }

      case 'boss_game': {
        // Draw space stars
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        for (let i = 0; i < 15; i++) {
          const starX = (state.time * (i + 1) * 3) % 400;
          const starY = (i * 20) % 300;
          ctx.fillRect(starX, starY, 2, 2);
        }

        // Draw player spaceship
        ctx.save();
        ctx.translate(state.playerX, state.playerY);
        // Wing spikes
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.moveTo(-16, 12);
        ctx.lineTo(-24, 18);
        ctx.lineTo(-12, 18);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(16, 12);
        ctx.lineTo(24, 18);
        ctx.lineTo(12, 18);
        ctx.closePath();
        ctx.fill();

        // Ship Body
        ctx.fillStyle = '#cbd5e1';
        ctx.strokeStyle = '#1e3a8a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(14, 14);
        ctx.lineTo(-14, 14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Thruster flame
        if (state.time % 6 < 3) {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.moveTo(-6, 15);
          ctx.lineTo(0, 26);
          ctx.lineTo(6, 15);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();

        // Draw Player Lasers
        ctx.fillStyle = '#ec4899'; // laser pink
        state.lasers.forEach((l: any) => {
          ctx.fillRect(l.x - 2, l.y, 4, 12);
        });

        // Draw Boss Wario Mech
        ctx.save();
        ctx.translate(state.bossX, state.bossY);

        if (state.bossFlash > 0) {
          // Flashing red
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 15;
        }

        // Giant mechanical brain/dome
        ctx.fillStyle = state.bossFlash > 0 ? '#ef4444' : '#64748b';
        ctx.beginPath();
        ctx.arc(0, 0, 35, Math.PI, 0);
        ctx.fill();

        // Mechanical body/jaw
        ctx.fillRect(-35, 0, 70, 24);

        // Huge yellow nose
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.ellipse(0, 4, 14, 18, 0, 0, Math.PI * 2);
        ctx.fill();

        // Glowing red cyber eyes
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-22, -10, 10, 4);
        ctx.fillRect(12, -10, 10, 4);

        // Yellow zig-zag mechanical mustache!
        ctx.fillStyle = '#8a2be2'; // purple mustache
        ctx.beginPath();
        ctx.moveTo(-35, 14);
        ctx.lineTo(-20, 24);
        ctx.lineTo(0, 12);
        ctx.lineTo(20, 24);
        ctx.lineTo(35, 14);
        ctx.lineTo(25, 6);
        ctx.lineTo(0, 8);
        ctx.lineTo(-25, 6);
        ctx.closePath();
        ctx.fill();

        ctx.restore();

        // Draw Boss HP Bar
        const barW = 200;
        const hpPct = state.bossHp / state.bossMaxHp;
        ctx.fillStyle = '#334155';
        ctx.fillRect(100, 12, barW, 8);
        ctx.fillStyle = hpPct > 0.4 ? '#22c55e' : '#ef4444';
        ctx.fillRect(100, 12, barW * hpPct, 8);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(99, 11, barW + 2, 10);

        // Draw Boss Projectiles (Fireballs)
        state.bossProjectiles.forEach((p: any) => {
          ctx.fillStyle = '#eab308';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fill();
        });

        // Draw Player hearts/HP in boss
        ctx.fillStyle = '#f43f5e';
        for (let i = 0; i < state.playerHp; i++) {
          ctx.font = '16px sans-serif';
          ctx.fillText('❤️', 15 + i * 22, 24);
        }
        break;
      }

      default:
        break;
    }

    // DRAW PARTICLES
    state.particles.forEach((p: any) => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // DRAW GENERIC BANNER LABELS OVER SCREEN (e.g. SUCCESS! / FAIL!)
    if (state.isCleared) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, 400, 300);

      ctx.save();
      ctx.shadowColor = '#15803d';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#22c55e';
      ctx.font = '32px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SUCCESS!', 200, 150);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeText('SUCCESS!', 200, 150);
      ctx.restore();
    } else if (state.isFailed) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, 400, 300);

      ctx.save();
      ctx.shadowColor = '#be123c';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ef4444';
      ctx.font = '32px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('FAIL!', 200, 150);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeText('FAIL!', 200, 150);
      ctx.restore();
    }
  };

  // HELPER TO DRAW CARD CONTENT shapes
  const drawCardContent = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    shape: string,
    color: string
  ) => {
    ctx.fillStyle = color;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;

    switch (shape) {
      case 'circle':
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;

      case 'square':
        ctx.beginPath();
        ctx.rect(x - 14, y - 14, 28, 28);
        ctx.fill();
        ctx.stroke();
        break;

      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(x, y - 16);
        ctx.lineTo(x + 16, y + 14);
        ctx.lineTo(x - 16, y + 14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;

      case 'star': {
        ctx.beginPath();
        let angle = Math.PI / 2;
        const step = Math.PI / 5;
        ctx.moveTo(x + Math.cos(angle) * 16, y - Math.sin(angle) * 16);
        for (let i = 0; i < 10; i++) {
          angle += step;
          const r = i % 2 === 0 ? 7 : 16;
          ctx.lineTo(x + Math.cos(angle) * r, y - Math.sin(angle) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
    }
  };

  return (
    <div className="relative overflow-hidden w-full h-full bg-slate-950 flex justify-center items-center rounded-lg border-4 border-slate-700">
      <canvas
        ref={canvasRef}
        width={400}
        height={300}
        className="w-full h-full aspect-[4/3] max-w-full block bg-slate-900 shadow-inner"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
};
