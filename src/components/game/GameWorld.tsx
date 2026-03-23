import { useRef, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  GameConfig, HudData, PlayerScore,
  PLAYER_COLORS, PLAYER_NAMES_AR, BASE_POSITIONS,
  ARENA_RADIUS, MAP_EXTENT, BASE_SIZE,
  CHICKEN_CATCH_DIST, BASE_DEPOSIT_DIST,
  MAX_CHICKENS, PLAYER_SPEED,
  CHICKEN_SPEED_NORMAL,
  CHALLENGES, ChickenType,
} from '@/types/game';
import { useKeyboard } from '@/hooks/useKeyboard';
import GameHUD from './GameHUD';

// ─── Internal Types ───
interface ChickenState {
  x: number; z: number;
  targetX: number; targetZ: number;
  type: ChickenType;
  carriedBy: number; // -1=free, 0=local, 1+=bot index+1
  active: boolean;
  speed: number;
  visible: boolean;
  blinkTimer: number;
}

interface BotState {
  x: number; z: number;
  carryingChickenIdx: number; // -1 = none
  score: number;
  frozen: boolean;
  frozenTimer: number;
  facingAngle: number;
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
    speed: type === 'fast' ? 4 : type === 'golden' ? 1.2 : CHICKEN_SPEED_NORMAL,
    visible: true, blinkTimer: 0,
  };
}
function createBot(index: number): BotState {
  const base = BASE_POSITIONS[index + 1];
  return {
    x: base[0], z: base[2],
    carryingChickenIdx: -1, score: 0,
    frozen: false, frozenTimer: 0, facingAngle: 0,
  };
}

// ─── 3D Sub-components ───
function Ground() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[45, 45]} />
        <meshStandardMaterial color="#4a8c3f" />
      </mesh>
      {/* Dirt ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[ARENA_RADIUS + 1.5, 32]} />
        <meshStandardMaterial color="#9a7030" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <circleGeometry args={[ARENA_RADIUS, 32]} />
        <meshStandardMaterial color="#8B6B28" />
      </mesh>
      {/* Inner patches */}
      {[...Array(8)].map((_, i) => {
        const a = (i / 8) * Math.PI * 2 + 0.3;
        const r = 3 + Math.random() * 5;
        return (
          <mesh key={i} position={[Math.cos(a) * r, 0.01, Math.sin(a) * r]} rotation={[-Math.PI / 2, a, 0]}>
            <circleGeometry args={[0.4, 6]} />
            <meshStandardMaterial color="#6b8e23" transparent opacity={0.4} />
          </mesh>
        );
      })}
      {/* Trees/bushes around */}
      {[...Array(10)].map((_, i) => {
        const a = (i / 10) * Math.PI * 2;
        const r = ARENA_RADIUS + 4 + Math.random() * 2;
        return (
          <group key={`tree-${i}`} position={[Math.cos(a) * r, 0, Math.sin(a) * r]}>
            <mesh position={[0, 0.6, 0]}>
              <sphereGeometry args={[0.8 + Math.random() * 0.4, 8, 8]} />
              <meshStandardMaterial color={i % 2 === 0 ? '#3a7d32' : '#2d6b28'} />
            </mesh>
            <mesh position={[0, 0.15, 0]}>
              <cylinderGeometry args={[0.1, 0.12, 0.3, 6]} />
              <meshStandardMaterial color="#6b4226" />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function BaseZone({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[BASE_SIZE, BASE_SIZE]} />
        <meshStandardMaterial color={color} transparent opacity={0.2} />
      </mesh>
      {/* Fence */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([fx, fz], i) => (
        <mesh key={i} position={[fx * BASE_SIZE * 0.5, 0.35, fz * BASE_SIZE * 0.5]}>
          <cylinderGeometry args={[0.06, 0.06, 0.7, 6]} />
          <meshStandardMaterial color="#7a4a20" />
        </mesh>
      ))}
      {[
        [0, -BASE_SIZE * 0.5], [0, BASE_SIZE * 0.5],
        [-BASE_SIZE * 0.5, 0], [BASE_SIZE * 0.5, 0],
      ].map(([fx, fz], i) => (
        <mesh key={`rail-${i}`} position={[fx, 0.25, fz]} rotation={[0, i >= 2 ? Math.PI / 2 : 0, 0]}>
          <boxGeometry args={[BASE_SIZE, 0.05, 0.05]} />
          <meshStandardMaterial color="#a0622d" />
        </mesh>
      ))}
      {/* Flag */}
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 1.2, 6]} />
        <meshStandardMaterial color="#5a3a1a" />
      </mesh>
      <mesh position={[0.2, 1.3, 0]}>
        <planeGeometry args={[0.4, 0.25]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ─── Player Character 3D ───
function PlayerCharacter3D({
  meshRef,
  color,
  isHunter,
}: {
  meshRef: React.RefObject<THREE.Group>;
  color: string;
  isHunter?: boolean;
}) {
  return (
    <group ref={meshRef}>
      {/* Shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.4, 12]} />
        <meshStandardMaterial color="#000" transparent opacity={0.15} />
      </mesh>
      {/* Body */}
      <mesh position={[0, 0.45, 0]}>
        <capsuleGeometry args={[0.22, 0.3, 8, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.9, 0]}>
        <sphereGeometry args={[0.2, 12, 12]} />
        <meshStandardMaterial color="#f5d5a8" />
      </mesh>
      {/* Hat/Cap */}
      <mesh position={[0, 1.05, 0]}>
        <coneGeometry args={[0.18, 0.2, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.96, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.25, 12]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.07, 0.93, 0.17]}>
        <sphereGeometry args={[0.035, 6, 6]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[0.07, 0.93, 0.17]}>
        <sphereGeometry args={[0.035, 6, 6]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      {/* Arms */}
      <mesh position={[-0.32, 0.45, 0]} rotation={[0, 0, 0.3]}>
        <capsuleGeometry args={[0.06, 0.25, 4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.32, 0.45, 0]} rotation={[0, 0, -0.3]}>
        <capsuleGeometry args={[0.06, 0.25, 4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Legs */}
      <mesh position={[-0.1, 0.12, 0]}>
        <capsuleGeometry args={[0.07, 0.15, 4, 8]} />
        <meshStandardMaterial color="#5a4020" />
      </mesh>
      <mesh position={[0.1, 0.12, 0]}>
        <capsuleGeometry args={[0.07, 0.15, 4, 8]} />
        <meshStandardMaterial color="#5a4020" />
      </mesh>
      {/* Hunter crown */}
      {isHunter && (
        <mesh position={[0, 1.25, 0]}>
          <coneGeometry args={[0.15, 0.2, 4]} />
          <meshStandardMaterial color="#ff2020" emissive="#ff0000" emissiveIntensity={0.6} />
        </mesh>
      )}
    </group>
  );
}

// ─── Chicken 3D ───
function Chicken3D({ chickenRef, type }: { chickenRef: React.RefObject<THREE.Group>; type: ChickenType }) {
  const isGolden = type === 'golden';
  const bodyColor = isGolden ? '#FFD700' : '#f5f5f0';
  const isExplosive = type === 'explosive';
  return (
    <group ref={chickenRef}>
      {/* Shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.2, 8]} />
        <meshStandardMaterial color="#000" transparent opacity={0.12} />
      </mesh>
      {/* Body */}
      <mesh position={[0, 0.22, 0]}>
        <sphereGeometry args={[0.2, 10, 10]} />
        <meshStandardMaterial
          color={isExplosive ? '#ff6b6b' : bodyColor}
          emissive={isGolden ? '#FFD700' : isExplosive ? '#ff0000' : '#000'}
          emissiveIntensity={isGolden ? 0.5 : isExplosive ? 0.3 : 0}
        />
      </mesh>
      {/* Tail feathers */}
      <mesh position={[0, 0.28, -0.2]} rotation={[-0.5, 0, 0]}>
        <coneGeometry args={[0.08, 0.18, 6]} />
        <meshStandardMaterial color={isGolden ? '#DAA520' : '#e8e0d0'} />
      </mesh>
      {/* Wing L */}
      <mesh position={[-0.18, 0.24, 0]} rotation={[0, 0, 0.4]}>
        <sphereGeometry args={[0.1, 6, 6]} />
        <meshStandardMaterial color={isGolden ? '#DAA520' : '#e8e0d0'} />
      </mesh>
      {/* Wing R */}
      <mesh position={[0.18, 0.24, 0]} rotation={[0, 0, -0.4]}>
        <sphereGeometry args={[0.1, 6, 6]} />
        <meshStandardMaterial color={isGolden ? '#DAA520' : '#e8e0d0'} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.42, 0.1]}>
        <sphereGeometry args={[0.12, 10, 10]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      {/* Comb */}
      <mesh position={[0, 0.54, 0.1]}>
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshStandardMaterial color="#e74c3c" />
      </mesh>
      <mesh position={[0, 0.56, 0.08]}>
        <sphereGeometry args={[0.035, 6, 6]} />
        <meshStandardMaterial color="#c0392b" />
      </mesh>
      {/* Wattle */}
      <mesh position={[0, 0.36, 0.2]}>
        <sphereGeometry args={[0.03, 6, 6]} />
        <meshStandardMaterial color="#e74c3c" />
      </mesh>
      {/* Beak */}
      <mesh position={[0, 0.4, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.03, 0.08, 6]} />
        <meshStandardMaterial color="#f39c12" />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.06, 0.45, 0.18]}>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.06, 0.45, 0.18]}>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* Feet */}
      <mesh position={[-0.07, 0.03, 0.02]}>
        <boxGeometry args={[0.04, 0.05, 0.1]} />
        <meshStandardMaterial color="#e67e22" />
      </mesh>
      <mesh position={[0.07, 0.03, 0.02]}>
        <boxGeometry args={[0.04, 0.05, 0.1]} />
        <meshStandardMaterial color="#e67e22" />
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
  const playerPos = useRef({ x: BASE_POSITIONS[0][0], z: BASE_POSITIONS[0][2] });
  const playerAngle = useRef(0);
  const playerGroupRef = useRef<THREE.Group>(null);
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
  const chickenGroupRefs = useRef<(THREE.Group | null)[]>([]);
  const botsRef = useRef<BotState[]>(
    Array.from({ length: config.botCount }, (_, i) => createBot(i))
  );
  const botGroupRefs = useRef<(THREE.Group | null)[]>([]);
  const localScore = useRef(0);
  const localCarriedIdx = useRef(-1); // index of chicken being carried, -1 = none
  const speedMult = useRef(1);
  const doublePoints = useRef(false);
  const hudTimer = useRef(0);
  const challengeTimer = useRef(0);
  const currentChallenge = useRef(0);
  const abilityCooldown = useRef(0);
  const abilityActive = useRef(false);
  const luckBoxes = useRef<LuckBox[]>([]);
  const luckBoxRefs = useRef<(THREE.Mesh | null)[]>([]);
  const stealCooldown = useRef(0);
  const walkCycle = useRef(0);
  const notificationRef = useRef('');
  const notificationTimer = useRef(0);

  useEffect(() => {
    camera.position.set(0, 28, 16);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  useEffect(() => {
    if (config.mode !== 'luck') return;
    luckBoxes.current = Array.from({ length: 6 }, () => {
      const [x, z] = randomInArena();
      const types: LuckBox['type'][] = ['speed', 'lose', 'freeze', 'double'];
      return { x, z, active: true, type: types[Math.floor(Math.random() * 4)], timer: 0 };
    });
  }, [config.mode]);

  // Respawn helper
  const respawnChickens = useCallback((chickens: ChickenState[]) => {
    const freeCount = chickens.filter(c => c.active && c.carriedBy < 0).length;
    if (freeCount < 6) {
      for (const c of chickens) {
        if (!c.active) {
          const isKingMode = config.mode === 'king';
          const isCrazyMode = config.mode === 'crazy';
          let type: ChickenType = 'normal';
          if (isKingMode && Math.random() < 0.12) type = 'golden';
          else if (isCrazyMode) {
            const t: ChickenType[] = ['normal', 'fast', 'teleport', 'explosive'];
            type = t[Math.floor(Math.random() * t.length)];
          }
          Object.assign(c, createChicken(type));
          if (chickens.filter(cc => cc.active && cc.carriedBy < 0).length >= 10) break;
        }
      }
    }
  }, [config.mode]);

  const showNotification = useCallback((text: string) => {
    notificationRef.current = text;
    notificationTimer.current = 2;
  }, []);

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
    const speed = PLAYER_SPEED * speedMult.current * delta;
    let dx = 0, dz = 0;
    if (keys.has('w') || keys.has('arrowup')) dz -= 1;
    if (keys.has('s') || keys.has('arrowdown')) dz += 1;
    if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
    if (keys.has('d') || keys.has('arrowright')) dx += 1;
    const moved = dx !== 0 || dz !== 0;
    if (moved) {
      const len = Math.sqrt(dx * dx + dz * dz);
      pos.x += (dx / len) * speed;
      pos.z += (dz / len) * speed;
      playerAngle.current = Math.atan2(dx, dz);
      walkCycle.current += delta * 12;
    }
    pos.x = Math.max(-MAP_EXTENT, Math.min(MAP_EXTENT, pos.x));
    pos.z = Math.max(-MAP_EXTENT, Math.min(MAP_EXTENT, pos.z));

    // Update player group
    if (playerGroupRef.current) {
      playerGroupRef.current.position.set(pos.x, 0, pos.z);
      playerGroupRef.current.rotation.y = playerAngle.current;
      // Walk animation
      if (moved) {
        const bob = Math.sin(walkCycle.current) * 0.04;
        playerGroupRef.current.position.y = bob;
      }
      // Invisible mode
      playerGroupRef.current.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (config.mode === 'invisible' && mat) {
            mat.transparent = true;
            mat.opacity = moved ? 0.35 : 0.08;
          }
        }
      });
    }

    // ── Ability ──
    if (config.mode === 'abilities' && keys.has(' ') && abilityCooldown.current <= 0 && !abilityActive.current) {
      abilityActive.current = true;
      abilityCooldown.current = 15;
      speedMult.current = 2.5;
      showNotification('⚡ سرعة خارقة!');
      setTimeout(() => { speedMult.current = 1; abilityActive.current = false; }, 3000);
    }
    if (abilityCooldown.current > 0) abilityCooldown.current -= delta;

    // ── Chicken AI ──
    const chickenSpeedMult = config.mode === 'crazy' ? 2.5 : 1;
    chickens.forEach((chicken, i) => {
      if (!chicken.active || chicken.carriedBy >= 0) return;

      // Teleport type
      if (chicken.type === 'teleport') {
        chicken.blinkTimer += delta;
        if (chicken.blinkTimer > 3) {
          chicken.blinkTimer = 0;
          const [nx, nz] = randomInArena();
          chicken.x = nx; chicken.z = nz;
          chicken.targetX = nx; chicken.targetZ = nz;
        }
      }

      const cdx = chicken.targetX - chicken.x;
      const cdz = chicken.targetZ - chicken.z;
      const cd = Math.sqrt(cdx * cdx + cdz * cdz);
      if (cd < 0.5) {
        const [tx, tz] = randomInArena();
        chicken.targetX = tx; chicken.targetZ = tz;
      } else {
        chicken.x += (cdx / cd) * chicken.speed * chickenSpeedMult * delta;
        chicken.z += (cdz / cd) * chicken.speed * chickenSpeedMult * delta;
      }

      const mesh = chickenGroupRefs.current[i];
      if (mesh) {
        mesh.position.set(chicken.x, 0, chicken.z);
        mesh.visible = chicken.active && chicken.visible;
        mesh.rotation.y = Math.atan2(cdx, cdz);
        // Wobble
        mesh.rotation.z = Math.sin(Date.now() * 0.006 + i * 2) * 0.08;
      }
    });

    // ── Carried chicken follows player ──
    if (localCarriedIdx.current >= 0) {
      const c = chickens[localCarriedIdx.current];
      if (c && c.active) {
        const mesh = chickenGroupRefs.current[localCarriedIdx.current];
        if (mesh) {
          mesh.position.set(
            pos.x - Math.sin(playerAngle.current) * 0.7,
            0.3,
            pos.z - Math.cos(playerAngle.current) * 0.7
          );
          mesh.visible = true;
        }
      }
    }

    // Carried chickens follow bots
    bots.forEach((bot, bi) => {
      if (bot.carryingChickenIdx >= 0) {
        const c = chickens[bot.carryingChickenIdx];
        if (c && c.active) {
          const mesh = chickenGroupRefs.current[bot.carryingChickenIdx];
          if (mesh) {
            mesh.position.set(
              bot.x - Math.sin(bot.facingAngle) * 0.7,
              0.3,
              bot.z - Math.cos(bot.facingAngle) * 0.7
            );
            mesh.visible = true;
          }
        }
      }
    });

    // Hide inactive chickens
    chickens.forEach((c, i) => {
      if (!c.active) {
        const mesh = chickenGroupRefs.current[i];
        if (mesh) mesh.visible = false;
      }
    });

    // ── Player catches chicken (ONLY 1 at a time) ──
    if (localCarriedIdx.current < 0) {
      for (let i = 0; i < chickens.length; i++) {
        const c = chickens[i];
        if (!c.active || c.carriedBy >= 0) continue;
        if (dist2(pos.x, pos.z, c.x, c.z) < CHICKEN_CATCH_DIST) {
          c.carriedBy = 0;
          localCarriedIdx.current = i;

          // Explosive chicken in crazy mode
          if (c.type === 'explosive') {
            c.carriedBy = -1;
            c.active = false;
            localCarriedIdx.current = -1;
            showNotification('💥 فرخة متفجرة! ضاعت!');
            // Scatter nearby free chickens
            chickens.forEach(c2 => {
              if (c2.active && c2.carriedBy < 0 && dist2(c.x, c.z, c2.x, c2.z) < 4) {
                const [nx, nz] = randomInArena();
                c2.x = nx; c2.z = nz;
                c2.targetX = nx; c2.targetZ = nz;
              }
            });
          }
          break;
        }
      }
    }

    // ── Deposit at base ──
    const myBase = BASE_POSITIONS[0];
    if (localCarriedIdx.current >= 0 && dist2(pos.x, pos.z, myBase[0], myBase[2]) < BASE_DEPOSIT_DIST) {
      const c = chickens[localCarriedIdx.current];
      let points = 1;
      if (c.type === 'golden') points = 5;
      if (doublePoints.current) points *= 2;
      localScore.current += points;
      c.active = false;
      c.carriedBy = -1;
      localCarriedIdx.current = -1;
      showNotification(`+${points} نقطة!`);
      respawnChickens(chickens);
    }

    // ── Theft Mode ──
    if (config.mode === 'theft' && stealCooldown.current <= 0 && localCarriedIdx.current < 0) {
      for (let bi = 0; bi < bots.length; bi++) {
        const base = BASE_POSITIONS[bi + 1];
        if (dist2(pos.x, pos.z, base[0], base[2]) < BASE_DEPOSIT_DIST && bots[bi].score > 0) {
          bots[bi].score -= 1;
          // Create a stolen chicken near player
          const inactiveC = chickens.find(ch => !ch.active);
          if (inactiveC) {
            const idx = chickens.indexOf(inactiveC);
            Object.assign(inactiveC, createChicken('normal'));
            inactiveC.carriedBy = 0;
            inactiveC.x = pos.x; inactiveC.z = pos.z;
            localCarriedIdx.current = idx;
            showNotification('🦹 سرقت فرخة!');
          }
          stealCooldown.current = 3;
          break;
        }
      }
    }
    if (stealCooldown.current > 0) stealCooldown.current -= delta;

    // ── Bot AI ──
    bots.forEach((bot, bi) => {
      if (bot.frozen) {
        bot.frozenTimer -= delta;
        if (bot.frozenTimer <= 0) bot.frozen = false;
        // Update mesh but don't move
        const grp = botGroupRefs.current[bi];
        if (grp) {
          grp.position.set(bot.x, 0, bot.z);
          // Frozen visual: blue tint handled via traverse if needed
        }
        return;
      }

      const botSpeed = PLAYER_SPEED * 0.55 * delta;
      const botBaseIdx = bi + 1;

      // Survival mode: bot 0 is hunter
      if (config.mode === 'survival' && bi === 0) {
        const hdx = pos.x - bot.x;
        const hdz = pos.z - bot.z;
        const hd = Math.sqrt(hdx * hdx + hdz * hdz);
        if (hd > 0.3) {
          bot.x += (hdx / hd) * botSpeed * 1.3;
          bot.z += (hdz / hd) * botSpeed * 1.3;
          bot.facingAngle = Math.atan2(hdx, hdz);
        }
        if (hd < 1.0 && localCarriedIdx.current >= 0) {
          // Player caught - loses chicken
          const c = chickens[localCarriedIdx.current];
          c.carriedBy = -1;
          const [nx, nz] = randomInArena();
          c.x = nx; c.z = nz; c.targetX = nx; c.targetZ = nz;
          localCarriedIdx.current = -1;
          showNotification('🏃 أمسك بك الصياد!');
        }
      } else if (bot.carryingChickenIdx < 0) {
        // Hunt nearest free chicken
        let nearestDist = Infinity;
        let nearestIdx = -1;
        chickens.forEach((c, ci) => {
          if (c.carriedBy >= 0 || !c.active) return;
          const d = dist2(bot.x, bot.z, c.x, c.z);
          if (d < nearestDist) { nearestDist = d; nearestIdx = ci; }
        });
        if (nearestIdx >= 0) {
          const c = chickens[nearestIdx];
          const bdx = c.x - bot.x;
          const bdz = c.z - bot.z;
          const bd = Math.sqrt(bdx * bdx + bdz * bdz);
          if (bd > 0.3) {
            bot.x += (bdx / bd) * botSpeed;
            bot.z += (bdz / bd) * botSpeed;
            bot.facingAngle = Math.atan2(bdx, bdz);
          }
          if (bd < CHICKEN_CATCH_DIST) {
            // Catch only 1
            c.carriedBy = botBaseIdx;
            bot.carryingChickenIdx = nearestIdx;
          }
        }
      } else {
        // Return to base with 1 chicken
        const base = BASE_POSITIONS[botBaseIdx];
        const bdx = base[0] - bot.x;
        const bdz = base[2] - bot.z;
        const bd = Math.sqrt(bdx * bdx + bdz * bdz);
        if (bd > 0.3) {
          bot.x += (bdx / bd) * botSpeed;
          bot.z += (bdz / bd) * botSpeed;
          bot.facingAngle = Math.atan2(bdx, bdz);
        }
        if (bd < BASE_DEPOSIT_DIST) {
          const c = chickens[bot.carryingChickenIdx];
          let pts = 1;
          if (c.type === 'golden') pts = 5;
          bot.score += pts;
          c.active = false;
          c.carriedBy = -1;
          bot.carryingChickenIdx = -1;
          respawnChickens(chickens);
        }
      }

      // Clamp bot to map
      bot.x = Math.max(-MAP_EXTENT, Math.min(MAP_EXTENT, bot.x));
      bot.z = Math.max(-MAP_EXTENT, Math.min(MAP_EXTENT, bot.z));

      // Update bot mesh
      const grp = botGroupRefs.current[bi];
      if (grp) {
        grp.position.set(bot.x, 0, bot.z);
        grp.rotation.y = bot.facingAngle;
        if (config.mode === 'invisible') {
          grp.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
              if (mat) { mat.transparent = true; mat.opacity = 0.12; }
            }
          });
        }
      }
    });

    // ── Luck Boxes ──
    if (config.mode === 'luck') {
      luckBoxes.current.forEach((box, i) => {
        if (!box.active) {
          box.timer += delta;
          if (box.timer > 6) {
            const [x, z] = randomInArena();
            box.x = x; box.z = z; box.active = true; box.timer = 0;
            const types: LuckBox['type'][] = ['speed', 'lose', 'freeze', 'double'];
            box.type = types[Math.floor(Math.random() * 4)];
          }
        }
        const mesh = luckBoxRefs.current[i];
        if (mesh) {
          mesh.visible = box.active;
          if (box.active) {
            mesh.position.set(box.x, 0.4 + Math.sin(Date.now() * 0.003 + i) * 0.15, box.z);
            mesh.rotation.y += delta * 2;
          }
        }
        if (box.active && dist2(pos.x, pos.z, box.x, box.z) < 1.0) {
          box.active = false;
          box.timer = 0;
          switch (box.type) {
            case 'speed':
              speedMult.current = 2;
              showNotification('💨 سرعة مضاعفة!');
              setTimeout(() => { speedMult.current = 1; }, 5000);
              break;
            case 'lose':
              if (localCarriedIdx.current >= 0) {
                const c = chickens[localCarriedIdx.current];
                c.carriedBy = -1;
                const [nx, nz] = randomInArena();
                c.x = nx; c.z = nz;
                localCarriedIdx.current = -1;
                showNotification('😱 خسرت الفرخة!');
              }
              break;
            case 'freeze':
              bots.forEach(b => { b.frozen = true; b.frozenTimer = 4; });
              showNotification('❄️ تجميد الخصوم!');
              break;
            case 'double':
              doublePoints.current = true;
              showNotification('✨ نقاط مضاعفة!');
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

    // ── Notification timer ──
    if (notificationTimer.current > 0) notificationTimer.current -= delta;

    // ── HUD Update ──
    hudTimer.current += delta;
    if (hudTimer.current > 0.15) {
      hudTimer.current = 0;
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
        localCarried: localCarriedIdx.current >= 0 ? 1 : 0,
        modeInfo: notificationTimer.current > 0 ? notificationRef.current : '',
        challengeText: config.mode === 'challenges' ? CHALLENGES[currentChallenge.current] : undefined,
        abilityReady: config.mode === 'abilities' ? abilityCooldown.current <= 0 && !abilityActive.current : undefined,
        abilityCooldown: config.mode === 'abilities' ? Math.ceil(Math.max(0, abilityCooldown.current)) : undefined,
      });
    }
  });

  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
      <directionalLight position={[-8, 15, -8]} intensity={0.25} />
      <hemisphereLight args={['#87ceeb', '#4a8c3f', 0.3]} />

      {config.mode === 'challenges' && currentChallenge.current === 2 && (
        <fog attach="fog" args={['#1a1a1a', 5, 18]} />
      )}

      <Ground />

      {/* Bases */}
      {BASE_POSITIONS.slice(0, config.botCount + 1).map((p, i) => (
        <BaseZone key={i} position={p} color={PLAYER_COLORS[i]} />
      ))}

      {/* Local Player */}
      <PlayerCharacter3D meshRef={playerGroupRef} color={PLAYER_COLORS[0]} />

      {/* Bot Players */}
      {botsRef.current.map((_, i) => (
        <PlayerCharacter3D
          key={`bot-${i}`}
          meshRef={{ current: null } as React.RefObject<THREE.Group>}
          color={PLAYER_COLORS[i + 1]}
          isHunter={config.mode === 'survival' && i === 0}
        />
      ))}
      {/* We need actual refs for bots - render invisible groups with refs */}
      {botsRef.current.map((bot, i) => (
        <group key={`botG-${i}`} ref={el => { botGroupRefs.current[i] = el; }} position={[bot.x, 0, bot.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <circleGeometry args={[0.4, 12]} />
            <meshStandardMaterial color="#000" transparent opacity={0.15} />
          </mesh>
          <mesh position={[0, 0.45, 0]}>
            <capsuleGeometry args={[0.22, 0.3, 8, 12]} />
            <meshStandardMaterial color={PLAYER_COLORS[i + 1]} />
          </mesh>
          <mesh position={[0, 0.9, 0]}>
            <sphereGeometry args={[0.2, 12, 12]} />
            <meshStandardMaterial color="#f5d5a8" />
          </mesh>
          <mesh position={[0, 1.05, 0]}>
            <coneGeometry args={[0.18, 0.2, 8]} />
            <meshStandardMaterial color={PLAYER_COLORS[i + 1]} />
          </mesh>
          <mesh position={[0, 0.96, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.25, 12]} />
            <meshStandardMaterial color={PLAYER_COLORS[i + 1]} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[-0.07, 0.93, 0.17]}>
            <sphereGeometry args={[0.035, 6, 6]} />
            <meshStandardMaterial color="#222" />
          </mesh>
          <mesh position={[0.07, 0.93, 0.17]}>
            <sphereGeometry args={[0.035, 6, 6]} />
            <meshStandardMaterial color="#222" />
          </mesh>
          <mesh position={[-0.32, 0.45, 0]} rotation={[0, 0, 0.3]}>
            <capsuleGeometry args={[0.06, 0.25, 4, 8]} />
            <meshStandardMaterial color={PLAYER_COLORS[i + 1]} />
          </mesh>
          <mesh position={[0.32, 0.45, 0]} rotation={[0, 0, -0.3]}>
            <capsuleGeometry args={[0.06, 0.25, 4, 8]} />
            <meshStandardMaterial color={PLAYER_COLORS[i + 1]} />
          </mesh>
          <mesh position={[-0.1, 0.12, 0]}>
            <capsuleGeometry args={[0.07, 0.15, 4, 8]} />
            <meshStandardMaterial color="#5a4020" />
          </mesh>
          <mesh position={[0.1, 0.12, 0]}>
            <capsuleGeometry args={[0.07, 0.15, 4, 8]} />
            <meshStandardMaterial color="#5a4020" />
          </mesh>
          {config.mode === 'survival' && i === 0 && (
            <mesh position={[0, 1.25, 0]}>
              <coneGeometry args={[0.15, 0.2, 4]} />
              <meshStandardMaterial color="#ff2020" emissive="#ff0000" emissiveIntensity={0.6} />
            </mesh>
          )}
        </group>
      ))}

      {/* Chickens */}
      {chickensRef.current.map((c, i) => (
        <group key={`chk-${i}`} ref={el => { chickenGroupRefs.current[i] = el; }} position={[c.x, 0, c.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
            <circleGeometry args={[0.18, 8]} />
            <meshStandardMaterial color="#000" transparent opacity={0.1} />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <sphereGeometry args={[0.2, 10, 10]} />
            <meshStandardMaterial
              color={c.type === 'golden' ? '#FFD700' : c.type === 'explosive' ? '#ff6b6b' : '#f5f5f0'}
              emissive={c.type === 'golden' ? '#FFD700' : c.type === 'explosive' ? '#ff0000' : '#000'}
              emissiveIntensity={c.type === 'golden' ? 0.5 : c.type === 'explosive' ? 0.3 : 0}
            />
          </mesh>
          <mesh position={[0, 0.28, -0.18]} rotation={[-0.5, 0, 0]}>
            <coneGeometry args={[0.07, 0.15, 6]} />
            <meshStandardMaterial color={c.type === 'golden' ? '#DAA520' : '#e8e0d0'} />
          </mesh>
          <mesh position={[-0.17, 0.24, 0]} rotation={[0, 0, 0.4]}>
            <sphereGeometry args={[0.09, 6, 6]} />
            <meshStandardMaterial color={c.type === 'golden' ? '#DAA520' : '#e8e0d0'} />
          </mesh>
          <mesh position={[0.17, 0.24, 0]} rotation={[0, 0, -0.4]}>
            <sphereGeometry args={[0.09, 6, 6]} />
            <meshStandardMaterial color={c.type === 'golden' ? '#DAA520' : '#e8e0d0'} />
          </mesh>
          <mesh position={[0, 0.42, 0.08]}>
            <sphereGeometry args={[0.11, 10, 10]} />
            <meshStandardMaterial color={c.type === 'golden' ? '#FFD700' : '#f5f5f0'} />
          </mesh>
          <mesh position={[0, 0.53, 0.08]}>
            <sphereGeometry args={[0.045, 6, 6]} />
            <meshStandardMaterial color="#e74c3c" />
          </mesh>
          <mesh position={[0, 0.35, 0.18]}>
            <sphereGeometry args={[0.025, 6, 6]} />
            <meshStandardMaterial color="#e74c3c" />
          </mesh>
          <mesh position={[0, 0.4, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.025, 0.07, 6]} />
            <meshStandardMaterial color="#f39c12" />
          </mesh>
          <mesh position={[-0.05, 0.44, 0.16]}>
            <sphereGeometry args={[0.018, 6, 6]} />
            <meshStandardMaterial color="#111" />
          </mesh>
          <mesh position={[0.05, 0.44, 0.16]}>
            <sphereGeometry args={[0.018, 6, 6]} />
            <meshStandardMaterial color="#111" />
          </mesh>
          <mesh position={[-0.06, 0.03, 0.02]}>
            <boxGeometry args={[0.035, 0.05, 0.08]} />
            <meshStandardMaterial color="#e67e22" />
          </mesh>
          <mesh position={[0.06, 0.03, 0.02]}>
            <boxGeometry args={[0.035, 0.05, 0.08]} />
            <meshStandardMaterial color="#e67e22" />
          </mesh>
          {c.type === 'fast' && (
            <mesh position={[0, 0.55, -0.05]}>
              <coneGeometry args={[0.04, 0.12, 4]} />
              <meshStandardMaterial color="#3498db" emissive="#3498db" emissiveIntensity={0.4} />
            </mesh>
          )}
        </group>
      ))}

      {/* Luck Boxes */}
      {config.mode === 'luck' && luckBoxes.current.map((box, i) => (
        <mesh key={`lb-${i}`} ref={el => { luckBoxRefs.current[i] = el; }}>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial
            color={box.type === 'speed' ? '#3498db' : box.type === 'lose' ? '#e74c3c' : box.type === 'freeze' ? '#00bcd4' : '#f1c40f'}
            emissive={box.type === 'speed' ? '#3498db' : box.type === 'lose' ? '#e74c3c' : box.type === 'freeze' ? '#00bcd4' : '#f1c40f'}
            emissiveIntensity={0.4}
          />
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
      setTimeout(() => onGameEnd(hudData.scores), 5000);
    }
  }, [gameOver, hudData.scores, onGameEnd]);

  const handleBack = useCallback(() => {
    onGameEnd(hudData.scores);
  }, [hudData.scores, onGameEnd]);

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{ background: '#2a2a2a' }}>
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
      <button
        onClick={handleBack}
        className="absolute top-4 left-4 bg-foreground/70 text-primary-foreground p-2 rounded-lg hover:bg-foreground/90 transition-colors z-10"
      >
        🏠
      </button>
    </div>
  );
}
