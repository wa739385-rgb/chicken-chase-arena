import { useRef, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  GameConfig, HudData, PlayerScore, AbilityType,
  PLAYER_COLORS, PLAYER_NAMES_AR, BASE_POSITIONS, TEAM_BASE_POSITIONS,
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
  deposited: boolean; // in a base
  depositedBase: number; // which base index
}

interface BotState {
  x: number; z: number;
  carryingChickenIdx: number;
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
    deposited: false, depositedBase: -1,
  };
}
function createBot(index: number, mode: string): BotState {
  const bases = mode === 'teams' ? TEAM_BASE_POSITIONS : BASE_POSITIONS;
  const baseIdx = mode === 'teams' ? (index < 2 ? 0 : 1) : Math.min(index + 1, bases.length - 1);
  const base = bases[baseIdx];
  return {
    x: base[0] + (Math.random() - 0.5) * 2, z: base[2] + (Math.random() - 0.5) * 2,
    carryingChickenIdx: -1, score: 0,
    frozen: false, frozenTimer: 0, facingAngle: 0,
  };
}

function getBasesForMode(mode: string, botCount: number) {
  if (mode === 'teams') return TEAM_BASE_POSITIONS;
  return BASE_POSITIONS.slice(0, botCount + 1);
}

function getBotBaseIndex(botIndex: number, mode: string): number {
  if (mode === 'teams') return botIndex < 2 ? 0 : 1;
  return botIndex + 1;
}

// ─── 3D Sub-components ───
function Ground() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[55, 55]} />
        <meshStandardMaterial color="#4a8c3f" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[ARENA_RADIUS + 2, 32]} />
        <meshStandardMaterial color="#9a7030" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <circleGeometry args={[ARENA_RADIUS, 32]} />
        <meshStandardMaterial color="#8B6B28" />
      </mesh>
      {[...Array(8)].map((_, i) => {
        const a = (i / 8) * Math.PI * 2 + 0.3;
        const r = 3 + Math.random() * 5;
        return (
          <mesh key={i} position={[Math.cos(a) * r, 0.01, Math.sin(a) * r]} rotation={[-Math.PI / 2, a, 0]}>
            <circleGeometry args={[0.5, 6]} />
            <meshStandardMaterial color="#6b8e23" transparent opacity={0.4} />
          </mesh>
        );
      })}
      {[...Array(12)].map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const r = ARENA_RADIUS + 5 + Math.random() * 2;
        return (
          <group key={`tree-${i}`} position={[Math.cos(a) * r, 0, Math.sin(a) * r]}>
            <mesh position={[0, 0.7, 0]}>
              <sphereGeometry args={[1 + Math.random() * 0.5, 8, 8]} />
              <meshStandardMaterial color={i % 2 === 0 ? '#3a7d32' : '#2d6b28'} />
            </mesh>
            <mesh position={[0, 0.15, 0]}>
              <cylinderGeometry args={[0.12, 0.14, 0.3, 6]} />
              <meshStandardMaterial color="#6b4226" />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function BaseZone({ position, color, depositedCount }: { position: [number, number, number]; color: string; depositedCount: number }) {
  // Show deposited chickens inside the fence
  const chickenPositions: [number, number][] = [];
  for (let i = 0; i < depositedCount; i++) {
    const row = Math.floor(i / 4);
    const col = i % 4;
    chickenPositions.push([
      -BASE_SIZE * 0.3 + col * (BASE_SIZE * 0.2),
      -BASE_SIZE * 0.3 + row * (BASE_SIZE * 0.2),
    ]);
  }

  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[BASE_SIZE, BASE_SIZE]} />
        <meshStandardMaterial color={color} transparent opacity={0.2} />
      </mesh>
      {/* Fence posts */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([fx, fz], i) => (
        <mesh key={i} position={[fx * BASE_SIZE * 0.5, 0.4, fz * BASE_SIZE * 0.5]}>
          <cylinderGeometry args={[0.07, 0.07, 0.8, 6]} />
          <meshStandardMaterial color="#7a4a20" />
        </mesh>
      ))}
      {/* Fence rails */}
      {[
        [0, -BASE_SIZE * 0.5], [0, BASE_SIZE * 0.5],
        [-BASE_SIZE * 0.5, 0], [BASE_SIZE * 0.5, 0],
      ].map(([fx, fz], i) => (
        <mesh key={`rail-${i}`} position={[fx, 0.3, fz]} rotation={[0, i >= 2 ? Math.PI / 2 : 0, 0]}>
          <boxGeometry args={[BASE_SIZE, 0.06, 0.06]} />
          <meshStandardMaterial color="#a0622d" />
        </mesh>
      ))}
      {/* Second rail */}
      {[
        [0, -BASE_SIZE * 0.5], [0, BASE_SIZE * 0.5],
        [-BASE_SIZE * 0.5, 0], [BASE_SIZE * 0.5, 0],
      ].map(([fx, fz], i) => (
        <mesh key={`rail2-${i}`} position={[fx, 0.55, fz]} rotation={[0, i >= 2 ? Math.PI / 2 : 0, 0]}>
          <boxGeometry args={[BASE_SIZE, 0.05, 0.05]} />
          <meshStandardMaterial color="#b5722e" />
        </mesh>
      ))}
      {/* Flag */}
      <mesh position={[0, 1.0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 1.4, 6]} />
        <meshStandardMaterial color="#5a3a1a" />
      </mesh>
      <mesh position={[0.22, 1.5, 0]}>
        <planeGeometry args={[0.45, 0.28]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
      {/* Deposited chickens visible in the base */}
      {chickenPositions.map(([cx, cz], idx) => (
        <group key={`dep-${idx}`} position={[cx, 0, cz]}>
          <mesh position={[0, 0.18, 0]}>
            <sphereGeometry args={[0.14, 8, 8]} />
            <meshStandardMaterial color="#f5f5f0" />
          </mesh>
          <mesh position={[0, 0.32, 0.05]}>
            <sphereGeometry args={[0.08, 6, 6]} />
            <meshStandardMaterial color="#f5f5f0" />
          </mesh>
          <mesh position={[0, 0.38, 0.05]}>
            <sphereGeometry args={[0.035, 4, 4]} />
            <meshStandardMaterial color="#e74c3c" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Scene Content ───
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
  const bases = getBasesForMode(config.mode, config.botCount);
  const playerBaseIdx = config.mode === 'teams' ? 0 : 0;
  const playerPos = useRef({ x: bases[playerBaseIdx][0], z: bases[playerBaseIdx][2] });
  const playerAngle = useRef(0);
  const playerGroupRef = useRef<THREE.Group>(null);
  const chickensRef = useRef<ChickenState[]>(
    Array.from({ length: MAX_CHICKENS }, (_, i) => {
      if (config.mode === 'king' && i === 0) return createChicken('golden');
      return createChicken('normal');
    })
  );
  const chickenGroupRefs = useRef<(THREE.Group | null)[]>([]);
  const botsRef = useRef<BotState[]>(
    Array.from({ length: config.botCount }, (_, i) => createBot(i, config.mode))
  );
  const botGroupRefs = useRef<(THREE.Group | null)[]>([]);
  const localScore = useRef(0);
  const localCarriedIdx = useRef(-1);
  const speedMult = useRef(1);
  const doublePoints = useRef(false);
  const hudTimer = useRef(0);
  const challengeTimer = useRef(0);
  const currentChallenge = useRef(0);
  const abilityCooldown = useRef(0);
  const abilityActive = useRef(false);
  const playerAbility = useRef<AbilityType>('speed');
  const playerInvisible = useRef(false);
  const luckBoxes = useRef<LuckBox[]>([]);
  const luckBoxRefs = useRef<(THREE.Mesh | null)[]>([]);
  const stealCooldown = useRef(0);
  const walkCycle = useRef(0);
  const notificationRef = useRef('');
  const notificationTimer = useRef(0);
  const depositedCounts = useRef<number[]>(bases.map(() => 0));

  // Assign random ability
  useEffect(() => {
    const abilities: AbilityType[] = ['speed', 'magnet', 'invisible', 'freeze'];
    playerAbility.current = abilities[Math.floor(Math.random() * abilities.length)];
  }, []);

  useEffect(() => {
    // Wider camera view
    camera.position.set(0, 35, 20);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  useEffect(() => {
    if (config.mode !== 'luck') return;
    luckBoxes.current = Array.from({ length: 8 }, () => {
      const [x, z] = randomInArena();
      const types: LuckBox['type'][] = ['speed', 'lose', 'freeze', 'double'];
      return { x, z, active: true, type: types[Math.floor(Math.random() * 4)], timer: 0 };
    });
  }, [config.mode]);

  // In invisible mode, chickens start hidden
  useEffect(() => {
    if (config.mode === 'invisible') {
      chickensRef.current.forEach(c => { c.visible = false; });
    }
  }, [config.mode]);

  const respawnChickens = useCallback((chickens: ChickenState[]) => {
    const freeCount = chickens.filter(c => c.active && c.carriedBy < 0 && !c.deposited).length;
    if (freeCount < 6) {
      for (const c of chickens) {
        if (!c.active) {
          let type: ChickenType = 'normal';
          if (config.mode === 'king' && Math.random() < 0.12) type = 'golden';
          Object.assign(c, createChicken(type));
          if (config.mode === 'invisible') c.visible = false;
          if (chickens.filter(cc => cc.active && cc.carriedBy < 0 && !cc.deposited).length >= 10) break;
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

    if (playerGroupRef.current) {
      playerGroupRef.current.position.set(pos.x, 0, pos.z);
      playerGroupRef.current.rotation.y = playerAngle.current;
      if (moved) {
        playerGroupRef.current.position.y = Math.sin(walkCycle.current) * 0.04;
      }
      // Invisible mode - players semi-visible
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
      const ability = playerAbility.current;
      
      switch (ability) {
        case 'speed':
          abilityCooldown.current = 15;
          speedMult.current = 2.5;
          showNotification('⚡ سرعة خارقة!');
          setTimeout(() => { speedMult.current = 1; abilityActive.current = false; }, 3000);
          break;
        case 'magnet': {
          abilityCooldown.current = 12;
          // Pull nearest free chicken to player
          let nearestDist = Infinity;
          let nearestIdx = -1;
          chickens.forEach((c, ci) => {
            if (c.carriedBy >= 0 || !c.active || c.deposited) return;
            const d = dist2(pos.x, pos.z, c.x, c.z);
            if (d < nearestDist) { nearestDist = d; nearestIdx = ci; }
          });
          if (nearestIdx >= 0 && localCarriedIdx.current < 0) {
            const c = chickens[nearestIdx];
            c.x = pos.x; c.z = pos.z;
            c.carriedBy = 0;
            localCarriedIdx.current = nearestIdx;
            showNotification('🧲 مغناطيس! جذبت فرخة!');
          } else {
            showNotification('🧲 مافي فراخ قريبة!');
          }
          setTimeout(() => { abilityActive.current = false; }, 1000);
          break;
        }
        case 'invisible':
          abilityCooldown.current = 18;
          playerInvisible.current = true;
          showNotification('👻 اختفيت عن البوتات!');
          setTimeout(() => { playerInvisible.current = false; abilityActive.current = false; }, 4000);
          break;
        case 'freeze':
          abilityCooldown.current = 20;
          bots.forEach(b => { b.frozen = true; b.frozenTimer = 3; });
          showNotification('❄️ جمّدت كل الخصوم!');
          setTimeout(() => { abilityActive.current = false; }, 1000);
          break;
      }
    }
    if (abilityCooldown.current > 0) abilityCooldown.current -= delta;

    // ── Chicken AI ──
    chickens.forEach((chicken, i) => {
      if (!chicken.active || chicken.carriedBy >= 0 || chicken.deposited) return;

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
        chicken.x += (cdx / cd) * chicken.speed * delta;
        chicken.z += (cdz / cd) * chicken.speed * delta;
      }

      const mesh = chickenGroupRefs.current[i];
      if (mesh) {
        mesh.position.set(chicken.x, 0, chicken.z);
        mesh.rotation.y = Math.atan2(cdx, cdz);
        mesh.rotation.z = Math.sin(Date.now() * 0.006 + i * 2) * 0.08;
        
        // Invisible mode: chickens hidden until player touches them
        if (config.mode === 'invisible') {
          const playerDist = dist2(pos.x, pos.z, chicken.x, chicken.z);
          if (playerDist < CHICKEN_CATCH_DIST * 1.5) {
            chicken.visible = true; // reveal on proximity
          }
          mesh.visible = chicken.visible && chicken.active;
        } else {
          mesh.visible = chicken.active;
        }
      }
    });

    // ── Carried chicken follows player ──
    if (localCarriedIdx.current >= 0) {
      const c = chickens[localCarriedIdx.current];
      if (c && c.active) {
        const mesh = chickenGroupRefs.current[localCarriedIdx.current];
        if (mesh) {
          mesh.position.set(
            pos.x - Math.sin(playerAngle.current) * 0.8,
            0.4,
            pos.z - Math.cos(playerAngle.current) * 0.8
          );
          mesh.visible = true;
        }
      }
    }

    // Carried chickens follow bots
    bots.forEach((bot) => {
      if (bot.carryingChickenIdx >= 0) {
        const c = chickens[bot.carryingChickenIdx];
        if (c && c.active) {
          const mesh = chickenGroupRefs.current[bot.carryingChickenIdx];
          if (mesh) {
            mesh.position.set(
              bot.x - Math.sin(bot.facingAngle) * 0.8,
              0.4,
              bot.z - Math.cos(bot.facingAngle) * 0.8
            );
            mesh.visible = true;
          }
        }
      }
    });

    // Hide inactive / deposited chickens
    chickens.forEach((c, i) => {
      if (!c.active || c.deposited) {
        const mesh = chickenGroupRefs.current[i];
        if (mesh) mesh.visible = false;
      }
    });

    // ── Player catches chicken (ONLY 1) ──
    if (localCarriedIdx.current < 0) {
      for (let i = 0; i < chickens.length; i++) {
        const c = chickens[i];
        if (!c.active || c.carriedBy >= 0 || c.deposited) continue;
        if (dist2(pos.x, pos.z, c.x, c.z) < CHICKEN_CATCH_DIST) {
          // In invisible mode, reveal on catch
          if (config.mode === 'invisible') c.visible = true;
          c.carriedBy = 0;
          localCarriedIdx.current = i;
          break;
        }
      }
    }

    // ── Deposit at base ──
    const myBase = bases[playerBaseIdx];
    if (localCarriedIdx.current >= 0 && dist2(pos.x, pos.z, myBase[0], myBase[2]) < BASE_DEPOSIT_DIST) {
      const c = chickens[localCarriedIdx.current];
      let points = 1;
      if (c.type === 'golden') points = 5;
      if (doublePoints.current) points *= 2;
      localScore.current += points;
      c.active = false;
      c.carriedBy = -1;
      c.deposited = true;
      c.depositedBase = playerBaseIdx;
      localCarriedIdx.current = -1;
      depositedCounts.current[playerBaseIdx]++;
      showNotification(`+${points} نقطة!`);
      respawnChickens(chickens);
    }

    // ── Theft Mode ──
    if (config.mode === 'theft' && stealCooldown.current <= 0 && localCarriedIdx.current < 0) {
      for (let bi = 0; bi < bots.length; bi++) {
        const botBase = getBotBaseIndex(bi, config.mode);
        const base = bases[botBase];
        if (!base) continue;
        if (dist2(pos.x, pos.z, base[0], base[2]) < BASE_DEPOSIT_DIST && bots[bi].score > 0) {
          bots[bi].score -= 1;
          depositedCounts.current[botBase] = Math.max(0, depositedCounts.current[botBase] - 1);
          const inactiveC = chickens.find(ch => !ch.active || ch.deposited);
          if (inactiveC) {
            const idx = chickens.indexOf(inactiveC);
            Object.assign(inactiveC, createChicken('normal'));
            inactiveC.carriedBy = 0;
            inactiveC.deposited = false;
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
        const grp = botGroupRefs.current[bi];
        if (grp) grp.position.set(bot.x, 0, bot.z);
        return;
      }

      const botSpeed = PLAYER_SPEED * 0.55 * delta;
      const botBase = getBotBaseIndex(bi, config.mode);

      // Survival mode: bot 0 is hunter - chase NEAREST player (not just local)
      if (config.mode === 'survival' && bi === 0) {
        // Find nearest target among all non-hunter entities
        let targetX = pos.x, targetZ = pos.z;
        let minD = dist2(bot.x, bot.z, pos.x, pos.z);
        
        // Also consider other bots as targets (chase nearest)
        bots.forEach((otherBot, oi) => {
          if (oi === 0) return; // skip self (hunter)
          const d = dist2(bot.x, bot.z, otherBot.x, otherBot.z);
          if (d < minD) {
            minD = d;
            targetX = otherBot.x;
            targetZ = otherBot.z;
          }
        });

        const hdx = targetX - bot.x;
        const hdz = targetZ - bot.z;
        const hd = Math.sqrt(hdx * hdx + hdz * hdz);
        if (hd > 0.3) {
          bot.x += (hdx / hd) * botSpeed * 1.3;
          bot.z += (hdz / hd) * botSpeed * 1.3;
          bot.facingAngle = Math.atan2(hdx, hdz);
        }
        // If close to player, make them lose chicken
        if (dist2(bot.x, bot.z, pos.x, pos.z) < 1.0 && localCarriedIdx.current >= 0) {
          const c = chickens[localCarriedIdx.current];
          c.carriedBy = -1;
          const [nx, nz] = randomInArena();
          c.x = nx; c.z = nz; c.targetX = nx; c.targetZ = nz;
          localCarriedIdx.current = -1;
          showNotification('🏃 أمسك بك الصياد!');
        }
        // If close to other bots, make them lose chicken too
        bots.forEach((otherBot, oi) => {
          if (oi === 0) return;
          if (dist2(bot.x, bot.z, otherBot.x, otherBot.z) < 1.0 && otherBot.carryingChickenIdx >= 0) {
            const c = chickens[otherBot.carryingChickenIdx];
            c.carriedBy = -1;
            const [nx, nz] = randomInArena();
            c.x = nx; c.z = nz; c.targetX = nx; c.targetZ = nz;
            otherBot.carryingChickenIdx = -1;
          }
        });
      } else if (bot.carryingChickenIdx < 0) {
        // Hunt nearest free chicken
        let nearestDist = Infinity;
        let nearestIdx = -1;
        chickens.forEach((c, ci) => {
          if (c.carriedBy >= 0 || !c.active || c.deposited) return;
          // In invisible mode, bots can still find chickens (they "feel" for them)
          const d = dist2(bot.x, bot.z, c.x, c.z);
          if (d < nearestDist) { nearestDist = d; nearestIdx = ci; }
        });

        // If invisible ability active, bot ignores player position
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
            if (config.mode === 'invisible') c.visible = true;
            c.carriedBy = botBase;
            bot.carryingChickenIdx = nearestIdx;
          }
        }
      } else {
        // Return to base
        const base = bases[botBase];
        if (base) {
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
            c.deposited = true;
            c.depositedBase = botBase;
            bot.carryingChickenIdx = -1;
            depositedCounts.current[botBase]++;
            respawnChickens(chickens);
          }
        }
      }

      // Clamp
      bot.x = Math.max(-MAP_EXTENT, Math.min(MAP_EXTENT, bot.x));
      bot.z = Math.max(-MAP_EXTENT, Math.min(MAP_EXTENT, bot.z));

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

    // ── Luck Boxes (player AND bots can pick up) ──
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
            mesh.position.set(box.x, 0.5 + Math.sin(Date.now() * 0.003 + i) * 0.15, box.z);
            mesh.rotation.y += delta * 2;
          }
        }

        if (!box.active) return;

        // Player picks up
        if (dist2(pos.x, pos.z, box.x, box.z) < 1.2) {
          box.active = false;
          box.timer = 0;
          applyLuckBox(box.type, -1); // -1 = player
        }

        // Bots pick up
        bots.forEach((bot, bi) => {
          if (!box.active) return;
          if (bot.frozen) return;
          if (dist2(bot.x, bot.z, box.x, box.z) < 1.2) {
            box.active = false;
            box.timer = 0;
            applyLuckBox(box.type, bi);
          }
        });
      });
    }

    function applyLuckBox(type: LuckBox['type'], entityIdx: number) {
      const isPlayer = entityIdx === -1;
      switch (type) {
        case 'speed':
          if (isPlayer) {
            speedMult.current = 2;
            showNotification('💨 سرعة مضاعفة!');
            setTimeout(() => { speedMult.current = 1; }, 5000);
          }
          // Bot speed boost is implicit (they already move)
          break;
        case 'lose':
          if (isPlayer && localCarriedIdx.current >= 0) {
            const c = chickens[localCarriedIdx.current];
            c.carriedBy = -1;
            const [nx, nz] = randomInArena();
            c.x = nx; c.z = nz;
            localCarriedIdx.current = -1;
            showNotification('😱 خسرت الفرخة!');
          } else if (!isPlayer && bots[entityIdx].carryingChickenIdx >= 0) {
            const c = chickens[bots[entityIdx].carryingChickenIdx];
            c.carriedBy = -1;
            const [nx, nz] = randomInArena();
            c.x = nx; c.z = nz;
            bots[entityIdx].carryingChickenIdx = -1;
          }
          break;
        case 'freeze':
          if (isPlayer) {
            bots.forEach(b => { b.frozen = true; b.frozenTimer = 4; });
            showNotification('❄️ تجميد الخصوم!');
          }
          // If bot picks it up, freeze player... we skip that for simplicity
          break;
        case 'double':
          if (isPlayer) {
            doublePoints.current = true;
            showNotification('✨ نقاط مضاعفة!');
            setTimeout(() => { doublePoints.current = false; }, 10000);
          }
          break;
      }
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
        { id: 'local', name: config.playerName || PLAYER_NAMES_AR[0], color: PLAYER_COLORS[0], score: localScore.current },
        ...bots.map((b, i) => ({
          id: `bot-${i}`, name: PLAYER_NAMES_AR[i + 1] || `بوت ${i + 1}`,
          color: PLAYER_COLORS[i + 1] || '#888', score: b.score,
        })),
      ];
      if (config.mode === 'teams') {
        scores.forEach((s, i) => {
          s.team = i <= 1 ? 0 : 1; // First 2 = team 0, rest = team 1
        });
      }
      onHudUpdate({
        scores,
        localCarried: localCarriedIdx.current >= 0 ? 1 : 0,
        modeInfo: notificationTimer.current > 0 ? notificationRef.current : '',
        challengeText: config.mode === 'challenges' ? CHALLENGES[currentChallenge.current] : undefined,
        abilityReady: config.mode === 'abilities' ? abilityCooldown.current <= 0 && !abilityActive.current : undefined,
        abilityCooldown: config.mode === 'abilities' ? Math.ceil(Math.max(0, abilityCooldown.current)) : undefined,
        abilityType: config.mode === 'abilities' ? playerAbility.current : undefined,
      });
    }
  });

  const chickenScale = 1.5; // Bigger chickens

  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[10, 25, 10]} intensity={1} castShadow />
      <directionalLight position={[-8, 18, -8]} intensity={0.25} />
      <hemisphereLight args={['#87ceeb', '#4a8c3f', 0.3]} />

      {config.mode === 'challenges' && currentChallenge.current === 2 && (
        <fog attach="fog" args={['#1a1a1a', 5, 18]} />
      )}

      <Ground />

      {/* Bases */}
      {bases.map((p, i) => (
        <BaseZone key={i} position={p} color={PLAYER_COLORS[i]} depositedCount={depositedCounts.current[i]} />
      ))}

      {/* Local Player */}
      <group ref={playerGroupRef}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <circleGeometry args={[0.4, 12]} />
          <meshStandardMaterial color="#000" transparent opacity={0.15} />
        </mesh>
        <mesh position={[0, 0.45, 0]}>
          <capsuleGeometry args={[0.25, 0.35, 8, 12]} />
          <meshStandardMaterial color={PLAYER_COLORS[0]} />
        </mesh>
        <mesh position={[0, 0.95, 0]}>
          <sphereGeometry args={[0.22, 12, 12]} />
          <meshStandardMaterial color="#f5d5a8" />
        </mesh>
        <mesh position={[0, 1.12, 0]}>
          <coneGeometry args={[0.2, 0.22, 8]} />
          <meshStandardMaterial color={PLAYER_COLORS[0]} />
        </mesh>
        <mesh position={[-0.08, 0.98, 0.19]}>
          <sphereGeometry args={[0.04, 6, 6]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        <mesh position={[0.08, 0.98, 0.19]}>
          <sphereGeometry args={[0.04, 6, 6]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        <mesh position={[-0.35, 0.48, 0]} rotation={[0, 0, 0.3]}>
          <capsuleGeometry args={[0.07, 0.28, 4, 8]} />
          <meshStandardMaterial color={PLAYER_COLORS[0]} />
        </mesh>
        <mesh position={[0.35, 0.48, 0]} rotation={[0, 0, -0.3]}>
          <capsuleGeometry args={[0.07, 0.28, 4, 8]} />
          <meshStandardMaterial color={PLAYER_COLORS[0]} />
        </mesh>
        <mesh position={[-0.12, 0.12, 0]}>
          <capsuleGeometry args={[0.08, 0.16, 4, 8]} />
          <meshStandardMaterial color="#5a4020" />
        </mesh>
        <mesh position={[0.12, 0.12, 0]}>
          <capsuleGeometry args={[0.08, 0.16, 4, 8]} />
          <meshStandardMaterial color="#5a4020" />
        </mesh>
      </group>

      {/* Bot Players */}
      {botsRef.current.map((bot, i) => (
        <group key={`botG-${i}`} ref={el => { botGroupRefs.current[i] = el; }} position={[bot.x, 0, bot.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <circleGeometry args={[0.4, 12]} />
            <meshStandardMaterial color="#000" transparent opacity={0.15} />
          </mesh>
          <mesh position={[0, 0.45, 0]}>
            <capsuleGeometry args={[0.25, 0.35, 8, 12]} />
            <meshStandardMaterial color={PLAYER_COLORS[i + 1] || '#888'} />
          </mesh>
          <mesh position={[0, 0.95, 0]}>
            <sphereGeometry args={[0.22, 12, 12]} />
            <meshStandardMaterial color="#f5d5a8" />
          </mesh>
          <mesh position={[0, 1.12, 0]}>
            <coneGeometry args={[0.2, 0.22, 8]} />
            <meshStandardMaterial color={PLAYER_COLORS[i + 1] || '#888'} />
          </mesh>
          <mesh position={[-0.08, 0.98, 0.19]}>
            <sphereGeometry args={[0.04, 6, 6]} />
            <meshStandardMaterial color="#222" />
          </mesh>
          <mesh position={[0.08, 0.98, 0.19]}>
            <sphereGeometry args={[0.04, 6, 6]} />
            <meshStandardMaterial color="#222" />
          </mesh>
          <mesh position={[-0.35, 0.48, 0]} rotation={[0, 0, 0.3]}>
            <capsuleGeometry args={[0.07, 0.28, 4, 8]} />
            <meshStandardMaterial color={PLAYER_COLORS[i + 1] || '#888'} />
          </mesh>
          <mesh position={[0.35, 0.48, 0]} rotation={[0, 0, -0.3]}>
            <capsuleGeometry args={[0.07, 0.28, 4, 8]} />
            <meshStandardMaterial color={PLAYER_COLORS[i + 1] || '#888'} />
          </mesh>
          <mesh position={[-0.12, 0.12, 0]}>
            <capsuleGeometry args={[0.08, 0.16, 4, 8]} />
            <meshStandardMaterial color="#5a4020" />
          </mesh>
          <mesh position={[0.12, 0.12, 0]}>
            <capsuleGeometry args={[0.08, 0.16, 4, 8]} />
            <meshStandardMaterial color="#5a4020" />
          </mesh>
          {config.mode === 'survival' && i === 0 && (
            <mesh position={[0, 1.3, 0]}>
              <coneGeometry args={[0.17, 0.22, 4]} />
              <meshStandardMaterial color="#ff2020" emissive="#ff0000" emissiveIntensity={0.6} />
            </mesh>
          )}
        </group>
      ))}

      {/* Chickens - bigger */}
      {chickensRef.current.map((c, i) => (
        <group key={`chk-${i}`} ref={el => { chickenGroupRefs.current[i] = el; }} position={[c.x, 0, c.z]} scale={[chickenScale, chickenScale, chickenScale]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
            <circleGeometry args={[0.2, 8]} />
            <meshStandardMaterial color="#000" transparent opacity={0.1} />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <sphereGeometry args={[0.22, 10, 10]} />
            <meshStandardMaterial
              color={c.type === 'golden' ? '#FFD700' : '#f5f5f0'}
              emissive={c.type === 'golden' ? '#FFD700' : '#000'}
              emissiveIntensity={c.type === 'golden' ? 0.5 : 0}
            />
          </mesh>
          <mesh position={[0, 0.3, -0.2]} rotation={[-0.5, 0, 0]}>
            <coneGeometry args={[0.08, 0.18, 6]} />
            <meshStandardMaterial color={c.type === 'golden' ? '#DAA520' : '#e8e0d0'} />
          </mesh>
          <mesh position={[-0.2, 0.26, 0]} rotation={[0, 0, 0.4]}>
            <sphereGeometry args={[0.1, 6, 6]} />
            <meshStandardMaterial color={c.type === 'golden' ? '#DAA520' : '#e8e0d0'} />
          </mesh>
          <mesh position={[0.2, 0.26, 0]} rotation={[0, 0, -0.4]}>
            <sphereGeometry args={[0.1, 6, 6]} />
            <meshStandardMaterial color={c.type === 'golden' ? '#DAA520' : '#e8e0d0'} />
          </mesh>
          <mesh position={[0, 0.44, 0.1]}>
            <sphereGeometry args={[0.13, 10, 10]} />
            <meshStandardMaterial color={c.type === 'golden' ? '#FFD700' : '#f5f5f0'} />
          </mesh>
          <mesh position={[0, 0.57, 0.1]}>
            <sphereGeometry args={[0.05, 6, 6]} />
            <meshStandardMaterial color="#e74c3c" />
          </mesh>
          <mesh position={[0, 0.37, 0.21]}>
            <sphereGeometry args={[0.03, 6, 6]} />
            <meshStandardMaterial color="#e74c3c" />
          </mesh>
          <mesh position={[0, 0.42, 0.23]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.03, 0.08, 6]} />
            <meshStandardMaterial color="#f39c12" />
          </mesh>
          <mesh position={[-0.06, 0.47, 0.18]}>
            <sphereGeometry args={[0.02, 6, 6]} />
            <meshStandardMaterial color="#111" />
          </mesh>
          <mesh position={[0.06, 0.47, 0.18]}>
            <sphereGeometry args={[0.02, 6, 6]} />
            <meshStandardMaterial color="#111" />
          </mesh>
          <mesh position={[-0.07, 0.03, 0.02]}>
            <boxGeometry args={[0.04, 0.06, 0.1]} />
            <meshStandardMaterial color="#e67e22" />
          </mesh>
          <mesh position={[0.07, 0.03, 0.02]}>
            <boxGeometry args={[0.04, 0.06, 0.1]} />
            <meshStandardMaterial color="#e67e22" />
          </mesh>
        </group>
      ))}

      {/* Luck Boxes */}
      {config.mode === 'luck' && luckBoxes.current.map((box, i) => (
        <mesh key={`lb-${i}`} ref={el => { luckBoxRefs.current[i] = el; }}>
          <boxGeometry args={[0.6, 0.6, 0.6]} />
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
        camera={{ position: [0, 35, 20], fov: 50, near: 0.1, far: 120 }}
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
