import { useRef, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  GameConfig, HudData, PlayerScore,
  PLAYER_COLORS, PLAYER_NAMES_AR, BASE_POSITIONS,
  ARENA_RADIUS, MAP_EXTENT, BASE_SIZE,
  CHICKEN_CATCH_DIST, BASE_DEPOSIT_DIST,
  MAX_CHICKENS, PLAYER_SPEED,
  CHICKEN_SPEED_NORMAL, CHICKEN_SPEED_CRAZY,
  CHALLENGES, ChickenType,
} from '@/types/game';
import { useKeyboard } from '@/hooks/useKeyboard';
import GameHUD from './GameHUD';

// ─── Internal Types ───
interface ChickenState {
  x: number; z: number;
  targetX: number; targetZ: number;
  type: ChickenType;
  carriedBy: number; // -1=free, 0=local, 1+=bot
  active: boolean;
  speed: number;
  visible: boolean;
  blinkTimer: number;
}

interface BotState {
  x: number; z: number;
  carrying: number;
  score: number;
  hunting: boolean;
  targetChicken: number;
  frozen: boolean;
  frozenTimer: number;
}

interface LuckBox {
  x: number; z: number;
  active: boolean;
  type: 'speed' | 'lose' | 'freeze' | 'double';
  timer: number;
}

// ─── Helpers ───
function dist2(ax: number, az: number, bx: number, bz: number) {
  return Math.sqrt((ax - bx) ** 2 + (az - bz) ** 2);
}

function randomInArena(): [number, number] {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.random() * (ARENA_RADIUS - 1);
  return [Math.cos(angle) * r, Math.sin(angle) * r];
}

function createChicken(type: ChickenType = 'normal'): ChickenState {
  const [x, z] = randomInArena();
  return {
    x, z, targetX: x, targetZ: z,
    type, carriedBy: -1, active: true,
    speed: type === 'fast' ? 4 : type === 'golden' ? 1 : CHICKEN_SPEED_NORMAL,
    visible: true, blinkTimer: 0,
  };
}

function createBot(index: number): BotState {
  const base = BASE_POSITIONS[index + 1];
  return {
    x: base[0], z: base[2],
    carrying: 0, score: 0,
    hunting: true, targetChicken: -1,
    frozen: false, frozenTimer: 0,
  };
}

// ─── 3D Sub-components ───
function Ground() {
  return (
    <>
      {/* Grass */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#5a9e4b" />
      </mesh>
      {/* Arena dirt circle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[ARENA_RADIUS + 1, 24]} />
        <meshStandardMaterial color="#a07830" />
      </mesh>
      {/* Inner arena detail */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[ARENA_RADIUS, 24]} />
        <meshStandardMaterial color="#8B6B28" />
      </mesh>
      {/* Grass patches around */}
      {[...Array(12)].map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const r = ARENA_RADIUS + 3;
        return (
          <mesh key={i} position={[Math.cos(a) * r, 0.02, Math.sin(a) * r]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[1.5, 8]} />
            <meshStandardMaterial color="#4a8e3b" />
          </mesh>
        );
      })}
    </>
  );
}

function BaseZone({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      {/* Base floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[BASE_SIZE, BASE_SIZE]} />
        <meshStandardMaterial color={color} transparent opacity={0.25} />
      </mesh>
      {/* Fence posts */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([fx, fz], i) => (
        <mesh key={i} position={[fx * BASE_SIZE / 2, 0.4, fz * BASE_SIZE / 2]}>
          <cylinderGeometry args={[0.08, 0.08, 0.8, 6]} />
          <meshStandardMaterial color="#8B4513" />
        </mesh>
      ))}
      {/* Fence rails */}
      {[
        { pos: [0, 0.3, -BASE_SIZE / 2] as [number, number, number], rot: [0, 0, 0] as [number, number, number], scale: [BASE_SIZE, 0.06, 0.06] as [number, number, number] },
        { pos: [0, 0.3, BASE_SIZE / 2] as [number, number, number], rot: [0, 0, 0] as [number, number, number], scale: [BASE_SIZE, 0.06, 0.06] as [number, number, number] },
        { pos: [-BASE_SIZE / 2, 0.3, 0] as [number, number, number], rot: [0, Math.PI / 2, 0] as [number, number, number], scale: [BASE_SIZE, 0.06, 0.06] as [number, number, number] },
        { pos: [BASE_SIZE / 2, 0.3, 0] as [number, number, number], rot: [0, Math.PI / 2, 0] as [number, number, number], scale: [BASE_SIZE, 0.06, 0.06] as [number, number, number] },
      ].map((rail, i) => (
        <mesh key={i} position={rail.pos} rotation={rail.rot} scale={rail.scale}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#A0522D" />
        </mesh>
      ))}
      {/* Color indicator */}
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

// ─── Scene Content (inside Canvas) ───
function SceneContent({
  config,
  onHudUpdate,
  gameOver,
  keysRef,
}: {
  config: GameConfig;
  onHudUpdate: (data: HudData) => void;
  gameOver: boolean;
  keysRef: React.RefObject<Set<string>>;
}) {
  const { camera } = useThree();

  // Refs for game data
  const playerPos = useRef({ x: BASE_POSITIONS[0][0], z: BASE_POSITIONS[0][2] });
  const playerMeshRef = useRef<THREE.Mesh>(null);
  const playerShadowRef = useRef<THREE.Mesh>(null);
  const chickensRef = useRef<ChickenState[]>(
    Array.from({ length: MAX_CHICKENS }, (_, i) => {
      if (config.mode === 'king' && i === 0) return createChicken('golden');
      if (config.mode === 'crazy') {
        const types: ChickenType[] = ['normal', 'fast', 'teleport', 'explosive'];
        return createChicken(types[Math.floor(Math.random() * types.length)]);
      }
      return createChicken('normal');
    })
  );
  const chickenRefs = useRef<(THREE.Group | null)[]>([]);
  const botsRef = useRef<BotState[]>(
    Array.from({ length: config.botCount }, (_, i) => createBot(i))
  );
  const botMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const localScore = useRef(0);
  const localCarried = useRef(0);
  const speedMultiplier = useRef(1);
  const doublePoints = useRef(false);
  const hudUpdateTimer = useRef(0);
  const challengeTimer = useRef(0);
  const currentChallenge = useRef(0);
  const abilityCooldown = useRef(0);
  const abilityActive = useRef(false);
  const luckBoxes = useRef<LuckBox[]>([]);
  const luckBoxRefs = useRef<(THREE.Mesh | null)[]>([]);
  const stolenProtection = useRef(0);

  // Initialize camera
  useEffect(() => {
    camera.position.set(0, 28, 16);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  // Spawn luck boxes periodically
  useEffect(() => {
    if (config.mode !== 'luck') return;
    luckBoxes.current = Array.from({ length: 5 }, () => {
      const [x, z] = randomInArena();
      const types: LuckBox['type'][] = ['speed', 'lose', 'freeze', 'double'];
      return { x, z, active: true, type: types[Math.floor(Math.random() * 4)], timer: 0 };
    });
  }, [config.mode]);

  // ─── GAME LOOP ───
  useFrame((_, rawDelta) => {
    if (gameOver) return;
    const delta = Math.min(rawDelta, 0.1);
    const keys = keysRef.current;
    if (!keys) return;
    const pos = playerPos.current;
    const chickens = chickensRef.current;
    const bots = botsRef.current;

    // ── Player Movement ──
    const speed = PLAYER_SPEED * speedMultiplier.current * delta;
    let moved = false;
    if (keys.has('w') || keys.has('arrowup')) { pos.z -= speed; moved = true; }
    if (keys.has('s') || keys.has('arrowdown')) { pos.z += speed; moved = true; }
    if (keys.has('a') || keys.has('arrowleft')) { pos.x -= speed; moved = true; }
    if (keys.has('d') || keys.has('arrowright')) { pos.x += speed; moved = true; }

    // Clamp to map
    pos.x = Math.max(-MAP_EXTENT, Math.min(MAP_EXTENT, pos.x));
    pos.z = Math.max(-MAP_EXTENT, Math.min(MAP_EXTENT, pos.z));

    // Update player mesh
    if (playerMeshRef.current) {
      playerMeshRef.current.position.set(pos.x, 0.5, pos.z);
      // Mode: invisible
      const mat = playerMeshRef.current.material as THREE.MeshStandardMaterial;
      if (config.mode === 'invisible') {
        mat.opacity = moved ? 0.4 : 0.1;
        mat.transparent = true;
      }
    }
    if (playerShadowRef.current) {
      playerShadowRef.current.position.set(pos.x, 0.03, pos.z);
    }

    // ── Ability (Space key) ──
    if (config.mode === 'abilities' && keys.has(' ') && abilityCooldown.current <= 0 && !abilityActive.current) {
      abilityActive.current = true;
      abilityCooldown.current = 15;
      // Apply ability (speed boost for local player)
      speedMultiplier.current = 2;
      setTimeout(() => {
        speedMultiplier.current = 1;
        abilityActive.current = false;
      }, 3000);
    }
    if (abilityCooldown.current > 0) abilityCooldown.current -= delta;

    // ── Chicken AI ──
    const chickenSpeedMult = config.mode === 'crazy' ? 3 : 1;
    chickens.forEach((chicken, i) => {
      if (!chicken.active || chicken.carriedBy >= 0) return;

      // Teleport type: random blink
      if (chicken.type === 'teleport') {
        chicken.blinkTimer += delta;
        if (chicken.blinkTimer > 3) {
          chicken.blinkTimer = 0;
          const [nx, nz] = randomInArena();
          chicken.x = nx;
          chicken.z = nz;
          chicken.targetX = nx;
          chicken.targetZ = nz;
        }
      }

      // Move toward target
      const dx = chicken.targetX - chicken.x;
      const dz = chicken.targetZ - chicken.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 0.5) {
        const [tx, tz] = randomInArena();
        chicken.targetX = tx;
        chicken.targetZ = tz;
      } else {
        chicken.x += (dx / d) * chicken.speed * chickenSpeedMult * delta;
        chicken.z += (dz / d) * chicken.speed * chickenSpeedMult * delta;
      }

      // Update mesh
      const mesh = chickenRefs.current[i];
      if (mesh) {
        mesh.position.set(chicken.x, 0, chicken.z);
        mesh.visible = chicken.visible;
        mesh.rotation.y = Math.atan2(dx, dz);
      }
    });

    // ── Carried chickens follow player ──
    let carriedIdx = 0;
    const totalCarried = chickens.filter(c => c.carriedBy === 0 && c.active).length;
    chickens.forEach((chicken, i) => {
      if (!chicken.active) {
        const mesh = chickenRefs.current[i];
        if (mesh) mesh.visible = false;
        return;
      }
      if (chicken.carriedBy === 0) {
        const angle = (carriedIdx / Math.max(totalCarried, 1)) * Math.PI * 2;
        const r = 0.9;
        const mesh = chickenRefs.current[i];
        if (mesh) {
          mesh.position.set(
            pos.x + Math.cos(angle) * r,
            0.1,
            pos.z + Math.sin(angle) * r
          );
          mesh.visible = true;
        }
        carriedIdx++;
      }
    });

    // Carried chickens follow bots
    bots.forEach((bot, bi) => {
      let bCarriedIdx = 0;
      const bTotal = chickens.filter(c => c.carriedBy === bi + 1 && c.active).length;
      chickens.forEach((chicken, ci) => {
        if (chicken.carriedBy === bi + 1 && chicken.active) {
          const angle = (bCarriedIdx / Math.max(bTotal, 1)) * Math.PI * 2;
          const mesh = chickenRefs.current[ci];
          if (mesh) {
            mesh.position.set(bot.x + Math.cos(angle) * 0.9, 0.1, bot.z + Math.sin(angle) * 0.9);
            mesh.visible = true;
          }
          bCarriedIdx++;
        }
      });
    });

    // ── Player-Chicken Collision ──
    chickens.forEach((chicken) => {
      if (!chicken.active || chicken.carriedBy >= 0) return;
      if (dist2(pos.x, pos.z, chicken.x, chicken.z) < CHICKEN_CATCH_DIST) {
        // Magnet ability or normal catch
        chicken.carriedBy = 0;
        localCarried.current++;

        // Explosive chicken
        if (chicken.type === 'explosive') {
          // Scatter nearby chickens
          chickens.forEach(c2 => {
            if (c2.carriedBy === 0 && c2 !== chicken) {
              c2.carriedBy = -1;
              const [nx, nz] = randomInArena();
              c2.x = nx; c2.z = nz;
              c2.targetX = nx; c2.targetZ = nz;
              localCarried.current = Math.max(0, localCarried.current - 1);
            }
          });
        }
      }
    });

    // ── Player at Base (deposit) ──
    const myBase = BASE_POSITIONS[0];
    if (dist2(pos.x, pos.z, myBase[0], myBase[2]) < BASE_DEPOSIT_DIST && localCarried.current > 0) {
      const points = doublePoints.current ? localCarried.current * 2 : localCarried.current;
      // Golden chicken bonus
      chickens.forEach(c => {
        if (c.carriedBy === 0 && c.type === 'golden') {
          localScore.current += 4; // extra 4 (total 5 with base 1)
        }
      });
      localScore.current += points;
      // Deactivate carried chickens and respawn
      chickens.forEach(c => {
        if (c.carriedBy === 0) {
          c.active = false;
          c.carriedBy = -1;
        }
      });
      localCarried.current = 0;
      // Respawn chickens
      const freeCount = chickens.filter(c => c.active && c.carriedBy < 0).length;
      if (freeCount < 8) {
        chickens.forEach(c => {
          if (!c.active && freeCount < 10) {
            Object.assign(c, createChicken(config.mode === 'king' && Math.random() < 0.1 ? 'golden' : 'normal'));
          }
        });
      }
    }

    // ── Theft Mode: steal from other bases ──
    if (config.mode === 'theft' && stolenProtection.current <= 0) {
      for (let bi = 0; bi < bots.length; bi++) {
        const base = BASE_POSITIONS[bi + 1];
        if (dist2(pos.x, pos.z, base[0], base[2]) < BASE_DEPOSIT_DIST && bots[bi].score > 0) {
          bots[bi].score -= 1;
          localCarried.current += 1;
          // Create a chicken carried by player
          const inactiveChicken = chickens.find(c => !c.active);
          if (inactiveChicken) {
            inactiveChicken.active = true;
            inactiveChicken.carriedBy = 0;
            inactiveChicken.x = pos.x;
            inactiveChicken.z = pos.z;
          }
          stolenProtection.current = 2; // 2 second cooldown
          break;
        }
      }
    }
    if (stolenProtection.current > 0) stolenProtection.current -= delta;

    // ── Bot AI ──
    bots.forEach((bot, bi) => {
      if (bot.frozen) {
        bot.frozenTimer -= delta;
        if (bot.frozenTimer <= 0) bot.frozen = false;
        return;
      }

      const botSpeed = PLAYER_SPEED * 0.6 * delta;
      const botBaseIdx = bi + 1;

      if (bot.hunting) {
        // Find nearest free chicken
        let nearestDist = Infinity;
        let nearestIdx = -1;
        chickens.forEach((c, ci) => {
          if (c.carriedBy >= 0 || !c.active) return;
          const d = dist2(bot.x, bot.z, c.x, c.z);
          if (d < nearestDist) { nearestDist = d; nearestIdx = ci; }
        });

        if (nearestIdx >= 0) {
          const c = chickens[nearestIdx];
          const dx = c.x - bot.x;
          const dz = c.z - bot.z;
          const d = Math.sqrt(dx * dx + dz * dz);
          if (d > 0.3) {
            bot.x += (dx / d) * botSpeed;
            bot.z += (dz / d) * botSpeed;
          }
          if (d < CHICKEN_CATCH_DIST) {
            c.carriedBy = botBaseIdx;
            bot.carrying++;
            if (bot.carrying >= 2 + Math.floor(Math.random() * 2)) {
              bot.hunting = false;
            }
          }
        }
      } else {
        // Return to base
        const base = BASE_POSITIONS[botBaseIdx];
        const dx = base[0] - bot.x;
        const dz = base[2] - bot.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d > 0.3) {
          bot.x += (dx / d) * botSpeed;
          bot.z += (dz / d) * botSpeed;
        }
        if (d < BASE_DEPOSIT_DIST) {
          bot.score += bot.carrying;
          chickens.forEach(c => {
            if (c.carriedBy === botBaseIdx) { c.active = false; c.carriedBy = -1; }
          });
          bot.carrying = 0;
          bot.hunting = true;
          // Respawn
          const freeCount = chickens.filter(c => c.active && c.carriedBy < 0).length;
          if (freeCount < 8) {
            chickens.forEach(c => {
              if (!c.active) Object.assign(c, createChicken('normal'));
            });
          }
        }
      }

      // Survival mode: bot 0 is hunter
      if (config.mode === 'survival' && bi === 0) {
        // Hunter chases player instead
        const dx = pos.x - bot.x;
        const dz = pos.z - bot.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d > 0.3) {
          bot.x += (dx / d) * botSpeed * 1.2;
          bot.z += (dz / d) * botSpeed * 1.2;
        }
        if (d < 1.0) {
          // Player caught! Lose carried chickens
          chickens.forEach(c => {
            if (c.carriedBy === 0) {
              c.carriedBy = -1;
              const [nx, nz] = randomInArena();
              c.x = nx; c.z = nz;
            }
          });
          localCarried.current = 0;
        }
      }

      // Update bot mesh
      const mesh = botMeshRefs.current[bi];
      if (mesh) {
        mesh.position.set(bot.x, 0.5, bot.z);
        if (config.mode === 'invisible') {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.opacity = 0.15;
          mat.transparent = true;
        }
        if (config.mode === 'survival' && bi === 0) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.emissive = new THREE.Color('#ff0000');
          mat.emissiveIntensity = 0.5 + Math.sin(Date.now() * 0.005) * 0.3;
        }
      }
    });

    // ── Luck Boxes ──
    if (config.mode === 'luck') {
      luckBoxes.current.forEach((box, i) => {
        if (!box.active) {
          box.timer += delta;
          if (box.timer > 8) {
            const [x, z] = randomInArena();
            box.x = x; box.z = z;
            box.active = true;
            box.timer = 0;
            const types: LuckBox['type'][] = ['speed', 'lose', 'freeze', 'double'];
            box.type = types[Math.floor(Math.random() * 4)];
          }
          const mesh = luckBoxRefs.current[i];
          if (mesh) mesh.visible = false;
          return;
        }
        const mesh = luckBoxRefs.current[i];
        if (mesh) {
          mesh.position.set(box.x, 0.4 + Math.sin(Date.now() * 0.003 + i) * 0.2, box.z);
          mesh.rotation.y += delta * 2;
          mesh.visible = true;
        }
        // Check player collision
        if (dist2(pos.x, pos.z, box.x, box.z) < 1.0) {
          box.active = false;
          switch (box.type) {
            case 'speed':
              speedMultiplier.current = 2;
              setTimeout(() => { speedMultiplier.current = 1; }, 5000);
              break;
            case 'lose':
              chickens.forEach(c => {
                if (c.carriedBy === 0) { c.carriedBy = -1; const [nx, nz] = randomInArena(); c.x = nx; c.z = nz; }
              });
              localCarried.current = 0;
              break;
            case 'freeze':
              bots.forEach(b => { b.frozen = true; b.frozenTimer = 4; });
              break;
            case 'double':
              doublePoints.current = true;
              setTimeout(() => { doublePoints.current = false; }, 10000);
              break;
          }
        }
      });
    }

    // ── Challenges ──
    if (config.mode === 'challenges') {
      challengeTimer.current += delta;
      if (challengeTimer.current > 30) {
        challengeTimer.current = 0;
        currentChallenge.current = (currentChallenge.current + 1) % CHALLENGES.length;
      }
    }

    // ── Teams mode: shared score ──
    // (simplified: player + bot0 = team A, bot1 + bot2 = team B)

    // ── HUD Update (throttled) ──
    hudUpdateTimer.current += delta;
    if (hudUpdateTimer.current > 0.2) {
      hudUpdateTimer.current = 0;
      const scores: PlayerScore[] = [
        { id: 'local', name: PLAYER_NAMES_AR[0], color: PLAYER_COLORS[0], score: localScore.current },
        ...bots.map((b, i) => ({
          id: `bot-${i}`, name: PLAYER_NAMES_AR[i + 1] || `بوت ${i + 1}`,
          color: PLAYER_COLORS[i + 1] || '#888', score: b.score,
        })),
      ];

      if (config.mode === 'teams') {
        scores[0].team = 0;
        if (scores[1]) scores[1].team = 0;
        if (scores[2]) scores[2].team = 1;
        if (scores[3]) scores[3].team = 1;
      }

      onHudUpdate({
        scores,
        localCarried: localCarried.current,
        modeInfo: '',
        challengeText: config.mode === 'challenges' ? CHALLENGES[currentChallenge.current] : undefined,
        abilityReady: config.mode === 'abilities' ? abilityCooldown.current <= 0 && !abilityActive.current : undefined,
        abilityCooldown: config.mode === 'abilities' ? Math.ceil(Math.max(0, abilityCooldown.current)) : undefined,
      });
    }
  });

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 20, 10]} intensity={0.9} castShadow />
      <directionalLight position={[-5, 15, -5]} intensity={0.3} />

      {/* Fog for dark challenge */}
      {config.mode === 'challenges' && currentChallenge.current === 2 && (
        <fog attach="fog" args={['#1a1a2e', 5, 20]} />
      )}

      <Ground />

      {/* Bases */}
      {BASE_POSITIONS.slice(0, config.botCount + 1).map((pos, i) => (
        <BaseZone key={i} position={pos} color={PLAYER_COLORS[i]} />
      ))}

      {/* Local Player */}
      <mesh ref={playerMeshRef} position={[BASE_POSITIONS[0][0], 0.5, BASE_POSITIONS[0][2]]} castShadow>
        <sphereGeometry args={[0.45, 16, 16]} />
        <meshStandardMaterial color={PLAYER_COLORS[0]} />
      </mesh>
      {/* Player shadow */}
      <mesh ref={playerShadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[BASE_POSITIONS[0][0], 0.03, BASE_POSITIONS[0][2]]}>
        <circleGeometry args={[0.5, 16]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.2} />
      </mesh>

      {/* Bot Players */}
      {botsRef.current.map((bot, i) => (
        <mesh
          key={`bot-${i}`}
          ref={el => { botMeshRefs.current[i] = el; }}
          position={[bot.x, 0.5, bot.z]}
          castShadow
        >
          <sphereGeometry args={[0.45, 16, 16]} />
          <meshStandardMaterial color={PLAYER_COLORS[i + 1]} />
        </mesh>
      ))}

      {/* Survival mode: hunter indicator */}
      {config.mode === 'survival' && (
        <mesh position={[botsRef.current[0]?.x || 0, 1.2, botsRef.current[0]?.z || 0]}>
          <coneGeometry args={[0.2, 0.4, 8]} />
          <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.5} />
        </mesh>
      )}

      {/* Chickens */}
      {chickensRef.current.map((_, i) => (
        <group key={`chicken-${i}`} ref={el => { chickenRefs.current[i] = el; }}>
          {/* Body */}
          <mesh position={[0, 0.25, 0]} castShadow>
            <sphereGeometry args={[0.22, 12, 12]} />
            <meshStandardMaterial
              color={chickensRef.current[i]?.type === 'golden' ? '#FFD700' : 'white'}
              emissive={chickensRef.current[i]?.type === 'golden' ? '#FFD700' : '#000'}
              emissiveIntensity={chickensRef.current[i]?.type === 'golden' ? 0.4 : 0}
            />
          </mesh>
          {/* Head */}
          <mesh position={[0, 0.47, 0.08]}>
            <sphereGeometry args={[0.13, 10, 10]} />
            <meshStandardMaterial
              color={chickensRef.current[i]?.type === 'golden' ? '#FFD700' : 'white'}
            />
          </mesh>
          {/* Comb */}
          <mesh position={[0, 0.6, 0.08]}>
            <coneGeometry args={[0.05, 0.1, 6]} />
            <meshStandardMaterial color="#e74c3c" />
          </mesh>
          {/* Beak */}
          <mesh position={[0, 0.43, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.03, 0.08, 6]} />
            <meshStandardMaterial color="#f39c12" />
          </mesh>
          {/* Eyes */}
          <mesh position={[-0.06, 0.5, 0.16]}>
            <sphereGeometry args={[0.02, 6, 6]} />
            <meshStandardMaterial color="#000" />
          </mesh>
          <mesh position={[0.06, 0.5, 0.16]}>
            <sphereGeometry args={[0.02, 6, 6]} />
            <meshStandardMaterial color="#000" />
          </mesh>
          {/* Feet */}
          <mesh position={[-0.08, 0.03, 0]}>
            <boxGeometry args={[0.04, 0.06, 0.12]} />
            <meshStandardMaterial color="#f39c12" />
          </mesh>
          <mesh position={[0.08, 0.03, 0]}>
            <boxGeometry args={[0.04, 0.06, 0.12]} />
            <meshStandardMaterial color="#f39c12" />
          </mesh>
        </group>
      ))}

      {/* Luck Boxes */}
      {config.mode === 'luck' && luckBoxes.current.map((_, i) => (
        <mesh key={`box-${i}`} ref={el => { luckBoxRefs.current[i] = el; }}>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color="#9b59b6" emissive="#9b59b6" emissiveIntensity={0.3} />
        </mesh>
      ))}
    </>
  );
}

// ─── Main Component ───
export default function GameWorld({
  config,
  onGameEnd,
}: {
  config: GameConfig;
  onGameEnd: (scores: PlayerScore[]) => void;
}) {
  const keysRef = useKeyboard();
  const [hudData, setHudData] = useState<HudData>({
    scores: [], localCarried: 0, modeInfo: '',
  });
  const [timeLeft, setTimeLeft] = useState(config.maxTime);
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setGameOver(true);
          clearInterval(interval);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (gameOver && hudData.scores.length > 0) {
      setTimeout(() => onGameEnd(hudData.scores), 3000);
    }
  }, [gameOver, hudData.scores, onGameEnd]);

  const handleBack = useCallback(() => {
    onGameEnd(hudData.scores);
  }, [hudData.scores, onGameEnd]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-foreground">
      <Canvas
        shadows
        camera={{ position: [0, 28, 16], fov: 50, near: 0.1, far: 100 }}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
      >
        <SceneContent
          config={config}
          onHudUpdate={setHudData}
          gameOver={gameOver}
          keysRef={keysRef}
        />
      </Canvas>
      <GameHUD hudData={hudData} timeLeft={timeLeft} mode={config.mode} gameOver={gameOver} />
      {/* Back button */}
      <button
        onClick={handleBack}
        className="absolute top-4 left-4 bg-foreground/70 text-primary-foreground p-2 rounded-lg hover:bg-foreground/90 transition-colors z-10"
      >
        🏠
      </button>
    </div>
  );
}
