import { useRef, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  GameConfig, HudData, PlayerScore, AbilityType, MapConfig,
  PLAYER_COLORS, PLAYER_NAMES_AR, BASE_POSITIONS, TEAM_BASE_POSITIONS,
  ARENA_RADIUS, MAP_EXTENT, BASE_SIZE,
  CHICKEN_CATCH_DIST, BASE_DEPOSIT_DIST,
  MAX_CHICKENS, PLAYER_SPEED,
  CHICKEN_SPEED_NORMAL,
  CHALLENGES, ChickenType, GAME_MAPS,
} from '@/types/game';
import { useKeyboard } from '@/hooks/useKeyboard';
import GameHUD from './GameHUD';
import { supabase } from '@/integrations/supabase/client';

// ─── Online player position state ───
interface RemotePlayerState {
  x: number;
  z: number;
  angle: number;
  score: number;
  carrying: boolean;
}

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

function getBasesForMode(mode: string, botCount: number, onlineCount: number = 0) {
  if (mode === 'teams') return TEAM_BASE_POSITIONS;
  const totalPlayers = Math.max(1, (onlineCount > 0 ? onlineCount : 1) + botCount);
  return BASE_POSITIONS.slice(0, Math.min(totalPlayers, 4));
}

function getBotBaseIndex(botIndex: number, mode: string): number {
  if (mode === 'teams') return botIndex < 2 ? 0 : 1;
  return botIndex + 1;
}

// ─── 3D Sub-components ───
function Ground({ mapConfig }: { mapConfig: MapConfig }) {
  // Pre-calculate static decoration positions using deterministic seed
  const decorations = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.4;
    const r = 3 + (i * 1.7 % 6);
    decorations.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, scale: 0.8 + (i % 3) * 0.3 });
  }

  const outerDecorations = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = ARENA_RADIUS + 4 + (i * 1.3 % 3);
    outerDecorations.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, scale: 0.9 + (i % 2) * 0.4 });
  }

  return (
    <>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color={mapConfig.groundColor} />
      </mesh>
      {/* Arena circle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[ARENA_RADIUS + 2, 48]} />
        <meshStandardMaterial color={mapConfig.arenaColor} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <circleGeometry args={[ARENA_RADIUS, 48]} />
        <meshStandardMaterial color={mapConfig.arenaBorderColor} />
      </mesh>
      {/* Arena border ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[ARENA_RADIUS - 0.15, ARENA_RADIUS + 0.15, 48]} />
        <meshStandardMaterial color={mapConfig.arenaBorderColor} transparent opacity={0.6} />
      </mesh>

      {/* Static grass/ground patches */}
      {[...Array(12)].map((_, i) => {
        const a = (i / 12) * Math.PI * 2 + 0.3;
        const r = 2 + (i * 2.1 % 7);
        return (
          <mesh key={`gp-${i}`} position={[Math.cos(a) * r, 0.01, Math.sin(a) * r]} rotation={[-Math.PI / 2, a, 0]}>
            <circleGeometry args={[0.4 + (i % 3) * 0.2, 6]} />
            <meshStandardMaterial color={mapConfig.grassPatches} transparent opacity={0.35} />
          </mesh>
        );
      })}

      {/* Trees - only for maps with hasTrees */}
      {mapConfig.hasTrees && outerDecorations.map((d, i) => (
        <group key={`tree-${i}`} position={[d.x, 0, d.z]}>
          {/* Trunk */}
          <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.15, 0.2, 0.8, 8]} />
            <meshStandardMaterial color={mapConfig.trunkColor} />
          </mesh>
          {/* Foliage layers */}
          <mesh position={[0, 1.0, 0]}>
            <sphereGeometry args={[0.9 * d.scale, 10, 10]} />
            <meshStandardMaterial color={i % 2 === 0 ? mapConfig.treeColor1 : mapConfig.treeColor2} />
          </mesh>
          <mesh position={[0, 1.5, 0]}>
            <sphereGeometry args={[0.6 * d.scale, 8, 8]} />
            <meshStandardMaterial color={mapConfig.treeColor1} />
          </mesh>
        </group>
      ))}

      {/* Desert: static cacti and rocks */}
      {mapConfig.decorationType === 'cacti' && decorations.map((d, i) => (
        <group key={`cactus-${i}`} position={[d.x, 0, d.z]}>
          <mesh position={[0, 0.6 * d.scale, 0]}>
            <cylinderGeometry args={[0.12, 0.16, 1.2 * d.scale, 8]} />
            <meshStandardMaterial color="#3a7a23" />
          </mesh>
          <mesh position={[0.25, 0.7 * d.scale, 0]} rotation={[0, 0, -0.6]}>
            <cylinderGeometry args={[0.06, 0.08, 0.5 * d.scale, 6]} />
            <meshStandardMaterial color="#3a7a23" />
          </mesh>
          {i % 3 === 0 && (
            <mesh position={[-0.2, 0.5 * d.scale, 0]} rotation={[0, 0, 0.5]}>
              <cylinderGeometry args={[0.05, 0.07, 0.35 * d.scale, 6]} />
              <meshStandardMaterial color="#3a7a23" />
            </mesh>
          )}
        </group>
      ))}
      {/* Desert rocks outside arena */}
      {mapConfig.decorationType === 'cacti' && outerDecorations.map((d, i) => (
        <group key={`drock-${i}`} position={[d.x, 0, d.z]}>
          <mesh position={[0, 0.2 * d.scale, 0]}>
            <dodecahedronGeometry args={[0.4 * d.scale, 0]} />
            <meshStandardMaterial color="#b8952a" roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Snow: static snowballs and ice */}
      {mapConfig.decorationType === 'snowballs' && decorations.map((d, i) => (
        <group key={`snow-${i}`} position={[d.x, 0, d.z]}>
          {/* Snowman or snow mound */}
          {i % 3 === 0 ? (
            <>
              <mesh position={[0, 0.3, 0]}>
                <sphereGeometry args={[0.4 * d.scale, 10, 8]} />
                <meshStandardMaterial color="#f0f5ff" />
              </mesh>
              <mesh position={[0, 0.65, 0]}>
                <sphereGeometry args={[0.25 * d.scale, 8, 8]} />
                <meshStandardMaterial color="#f0f5ff" />
              </mesh>
            </>
          ) : (
            <mesh position={[0, 0.15, 0]}>
              <sphereGeometry args={[0.35 * d.scale, 8, 6]} />
              <meshStandardMaterial color="#e8f0ff" />
            </mesh>
          )}
        </group>
      ))}
      {/* Snow: ice crystals outside */}
      {mapConfig.decorationType === 'snowballs' && outerDecorations.map((d, i) => (
        <group key={`ice-${i}`} position={[d.x, 0, d.z]}>
          <mesh position={[0, 0.5 * d.scale, 0]} rotation={[0, i * 0.5, 0]}>
            <octahedronGeometry args={[0.4 * d.scale, 0]} />
            <meshStandardMaterial color="#c0e0f8" transparent opacity={0.7} />
          </mesh>
        </group>
      ))}

      {/* Night: lanterns */}
      {mapConfig.id === 'night' && decorations.map((d, i) => (
        <group key={`lantern-${i}`} position={[d.x, 0, d.z]}>
          <mesh position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 1.0, 6]} />
            <meshStandardMaterial color="#5a4020" />
          </mesh>
          <mesh position={[0, 1.3, 0]}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshStandardMaterial color="#ffe0a0" emissive="#ffe0a0" emissiveIntensity={0.8} />
          </mesh>
          <pointLight position={[d.x, 1.5, d.z]} color="#ffe0a0" intensity={0.8} distance={6} />
        </group>
      ))}

      {/* Volcano: lava rocks and glow */}
      {mapConfig.decorationType === 'lava' && decorations.map((d, i) => (
        <group key={`lava-${i}`} position={[d.x, 0, d.z]}>
          <mesh position={[0, 0.25 * d.scale, 0]}>
            <dodecahedronGeometry args={[0.35 * d.scale, 0]} />
            <meshStandardMaterial color="#2a1a0a" roughness={1} />
          </mesh>
          {i % 2 === 0 && (
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.3 * d.scale, 8]} />
              <meshStandardMaterial color="#ff4400" emissive="#ff2200" emissiveIntensity={0.6} transparent opacity={0.5} />
            </mesh>
          )}
        </group>
      ))}
      {mapConfig.decorationType === 'lava' && outerDecorations.map((d, i) => (
        <group key={`vrock-${i}`} position={[d.x, 0, d.z]}>
          <mesh position={[0, 0.3 * d.scale, 0]}>
            <dodecahedronGeometry args={[0.5 * d.scale, 1]} />
            <meshStandardMaterial color="#1a0a0a" roughness={0.95} />
          </mesh>
          {i % 3 === 0 && (
            <pointLight position={[d.x, 0.5, d.z]} color="#ff4400" intensity={0.5} distance={4} />
          )}
        </group>
      ))}

      {/* Space: glowing crystals */}
      {mapConfig.decorationType === 'crystals' && decorations.map((d, i) => (
        <group key={`crystal-${i}`} position={[d.x, 0, d.z]}>
          <mesh position={[0, 0.5 * d.scale, 0]} rotation={[0.2, i * 1.1, 0.1]}>
            <octahedronGeometry args={[0.3 * d.scale, 0]} />
            <meshStandardMaterial
              color={i % 3 === 0 ? '#8a4af0' : i % 3 === 1 ? '#4a8af0' : '#f04aaa'}
              emissive={i % 3 === 0 ? '#8a4af0' : i % 3 === 1 ? '#4a8af0' : '#f04aaa'}
              emissiveIntensity={0.6}
              transparent opacity={0.85}
            />
          </mesh>
        </group>
      ))}
      {mapConfig.decorationType === 'crystals' && outerDecorations.map((d, i) => (
        <group key={`srock-${i}`} position={[d.x, 0, d.z]}>
          <mesh position={[0, 0.2, 0]}>
            <dodecahedronGeometry args={[0.3 * d.scale, 0]} />
            <meshStandardMaterial color="#1a1a3a" />
          </mesh>
          {i % 2 === 0 && (
            <pointLight position={[d.x, 0.8, d.z]} color="#8a4af0" intensity={0.4} distance={5} />
          )}
        </group>
      ))}
    </>
  );
}

function BaseZone({ position, color, depositedCount }: { position: [number, number, number]; color: string; depositedCount: number }) {
  // Show deposited chickens inside the fence, scale down if many
  const chickenPositions: [number, number][] = [];
  const maxPerRow = Math.max(4, Math.ceil(Math.sqrt(depositedCount)));
  const chickenScale = depositedCount > 12 ? Math.max(0.4, 12 / depositedCount) : 1;
  const spacing = (BASE_SIZE * 0.6) / maxPerRow;
  for (let i = 0; i < depositedCount; i++) {
    const row = Math.floor(i / maxPerRow);
    const col = i % maxPerRow;
    chickenPositions.push([
      -BASE_SIZE * 0.25 + col * spacing,
      -BASE_SIZE * 0.25 + row * spacing,
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
        <group key={`dep-${idx}`} position={[cx, 0, cz]} scale={[chickenScale, chickenScale, chickenScale]}>
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
  const mapConfig = GAME_MAPS.find(m => m.id === config.mapId) || GAME_MAPS[0];
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
  // Map-specific state
  const mapTimer = useRef(0);
  const playerFrozen = useRef(false);
  const playerFrozenTimer = useRef(0);
  const nightDarkness = useRef(false);
  const nightDarknessTimer = useRef(0);
  const playerFloatY = useRef(0); // space floating

  // Assign random ability
  useEffect(() => {
    const abilities: AbilityType[] = ['speed', 'magnet', 'invisible', 'freeze'];
    playerAbility.current = abilities[Math.floor(Math.random() * abilities.length)];
  }, []);

  useEffect(() => {
    // Camera closer so players can see walls
    camera.position.set(0, 22, 14);
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

    // ── Map-specific mechanics ──
    mapTimer.current += delta;

    // Desert: slower movement
    const mapSpeedMult = config.mapId === 'desert' ? 0.7 : config.mapId === 'space' ? 1.15 : 1;

    // Snow: freeze every 10 seconds for 2 seconds
    if (config.mapId === 'snow') {
      if (!playerFrozen.current && mapTimer.current > 10) {
        playerFrozen.current = true;
        playerFrozenTimer.current = 2;
        mapTimer.current = 0;
        showNotification('❄️ تجمّدت! انتظر...');
        // Freeze bots too
        bots.forEach(b => { b.frozen = true; b.frozenTimer = 2; });
      }
      if (playerFrozen.current) {
        playerFrozenTimer.current -= delta;
        if (playerFrozenTimer.current <= 0) playerFrozen.current = false;
      }
    }

    // Night: darkness every 8 seconds for 3 seconds
    if (config.mapId === 'night') {
      nightDarknessTimer.current += delta;
      if (!nightDarkness.current && nightDarknessTimer.current > 8) {
        nightDarkness.current = true;
        nightDarknessTimer.current = 0;
        showNotification('🌑 ظلام دامس!');
      }
      if (nightDarkness.current && nightDarknessTimer.current > 3) {
        nightDarkness.current = false;
        nightDarknessTimer.current = 0;
      }
    }

    // Space: floating effect
    if (config.mapId === 'space') {
      playerFloatY.current = Math.sin(Date.now() * 0.002) * 0.3 + 0.3;
    }

    // ── Player Movement ──
    const isFrozenByMap = playerFrozen.current;
    const speed = PLAYER_SPEED * speedMult.current * mapSpeedMult * delta;
    let dx = 0, dz = 0;
    if (!isFrozenByMap) {
      if (keys.has('w') || keys.has('arrowup')) dz -= 1;
      if (keys.has('s') || keys.has('arrowdown')) dz += 1;
      if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
      if (keys.has('d') || keys.has('arrowright')) dx += 1;
    }
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

    // Volcano: center lava zone (radius 2.5) - touching resets player to base
    if (config.mapId === 'volcano') {
      const centerDist = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
      if (centerDist < 2.5) {
        const myBase = bases[playerBaseIdx];
        pos.x = myBase[0];
        pos.z = myBase[2];
        if (localCarriedIdx.current >= 0) {
          const c = chickens[localCarriedIdx.current];
          c.carriedBy = -1;
          const [nx, nz] = randomInArena();
          c.x = nx; c.z = nz; c.targetX = nx; c.targetZ = nz;
          localCarriedIdx.current = -1;
        }
        showNotification('🌋 لمست البركان! رجعت للقاعدة!');
      }
      // Same for bots
      bots.forEach((bot, bi) => {
        const bd = Math.sqrt(bot.x * bot.x + bot.z * bot.z);
        if (bd < 2.5) {
          const botBase = getBotBaseIndex(bi, config.mode);
          const base = bases[botBase];
          if (base) {
            bot.x = base[0]; bot.z = base[2];
            if (bot.carryingChickenIdx >= 0) {
              const c = chickens[bot.carryingChickenIdx];
              c.carriedBy = -1;
              const [nx, nz] = randomInArena();
              c.x = nx; c.z = nz;
              bot.carryingChickenIdx = -1;
            }
          }
        }
      });
    }

    const baseY = config.mapId === 'space' ? playerFloatY.current : 0;
    if (playerGroupRef.current) {
      playerGroupRef.current.position.set(pos.x, baseY, pos.z);
      playerGroupRef.current.rotation.y = playerAngle.current;
      if (moved && config.mapId !== 'space') {
        playerGroupRef.current.position.y = baseY + Math.sin(walkCycle.current) * 0.04;
      }
      // Frozen visual
      if (isFrozenByMap) {
        playerGroupRef.current.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
            if (mat) { mat.transparent = true; mat.opacity = 0.5; }
          }
        });
      }
      // Invisible mode - players semi-visible
      if (config.mode === 'invisible') {
        playerGroupRef.current.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
            if (mat) {
              mat.transparent = true;
              mat.opacity = moved ? 0.35 : 0.08;
            }
          }
        });
      }
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
      // Keep chickens inside arena
      const chickenDist = Math.sqrt(chicken.x * chicken.x + chicken.z * chicken.z);
      if (chickenDist > ARENA_RADIUS - 0.5) {
        const scale = (ARENA_RADIUS - 0.5) / chickenDist;
        chicken.x *= scale;
        chicken.z *= scale;
        const [tx, tz] = randomInArena();
        chicken.targetX = tx; chicken.targetZ = tz;
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
        if (grp) grp.position.set(bot.x, config.mapId === 'space' ? Math.sin(Date.now() * 0.002 + bi) * 0.3 + 0.3 : 0, bot.z);
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
        grp.position.set(bot.x, config.mapId === 'space' ? Math.sin(Date.now() * 0.002 + bi + 2) * 0.3 + 0.3 : 0, bot.z);
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
        currentChallenge.current = Math.floor(Math.random() * CHALLENGES.length);
        const challenge = CHALLENGES[currentChallenge.current];
        showNotification(`🎯 تحدي جديد: ${challenge}`);
        
        // Apply challenge effects
        switch (currentChallenge.current) {
          case 2: // Dark map - handled by fog in render
            break;
          case 4: // Slow speed
            speedMult.current = 0.5;
            setTimeout(() => { speedMult.current = 1; }, 30000);
            break;
          case 3: // Double points
            doublePoints.current = true;
            setTimeout(() => { doublePoints.current = false; }, 30000);
            break;
        }
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
      <ambientLight intensity={nightDarkness.current ? 0.05 : mapConfig.ambientIntensity} />
      <directionalLight position={[10, 25, 10]} intensity={nightDarkness.current ? 0.02 : (mapConfig.id === 'night' ? 0.3 : 1)} castShadow />
      <directionalLight position={[-8, 18, -8]} intensity={nightDarkness.current ? 0.01 : (mapConfig.id === 'night' ? 0.1 : 0.25)} />
      <hemisphereLight args={[mapConfig.skyColor, mapConfig.groundColor, nightDarkness.current ? 0.02 : 0.3]} />

      {nightDarkness.current && (
        <fog attach="fog" args={['#000000', 2, 8]} />
      )}
      {!nightDarkness.current && mapConfig.fogColor && (
        <fog attach="fog" args={[mapConfig.fogColor, mapConfig.fogNear || 20, mapConfig.fogFar || 60]} />
      )}
      {config.mode === 'challenges' && currentChallenge.current === 2 && (
        <fog attach="fog" args={['#1a1a1a', 5, 18]} />
      )}

      <Ground mapConfig={mapConfig} />

      {/* Volcano center lava pool */}
      {config.mapId === 'volcano' && (
        <group position={[0, 0, 0]}>
          {/* Volcano cone */}
          <mesh position={[0, 0.8, 0]}>
            <coneGeometry args={[2.5, 1.8, 16]} />
            <meshStandardMaterial color="#2a1510" roughness={0.95} />
          </mesh>
          {/* Lava pool on top */}
          <mesh position={[0, 1.72, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[1.2, 16]} />
            <meshStandardMaterial color="#ff4400" emissive="#ff2200" emissiveIntensity={1.2} />
          </mesh>
          {/* Glow */}
          <pointLight position={[0, 2.5, 0]} color="#ff4400" intensity={2} distance={10} />
          {/* Warning ring */}
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[2.2, 2.8, 24]} />
            <meshStandardMaterial color="#ff6600" emissive="#ff4400" emissiveIntensity={0.5} transparent opacity={0.4} />
          </mesh>
        </group>
      )}

      {/* Bases */}
      {bases.map((p, i) => (
        <BaseZone key={i} position={p} color={PLAYER_COLORS[i]} depositedCount={depositedCounts.current[i]} />
      ))}

      {/* Local Player - improved character */}
      <group ref={playerGroupRef}>
        {/* Shadow */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <circleGeometry args={[0.45, 16]} />
          <meshStandardMaterial color="#000" transparent opacity={0.2} />
        </mesh>
        {/* Body - rounded torso */}
        <mesh position={[0, 0.5, 0]}>
          <capsuleGeometry args={[0.28, 0.4, 12, 16]} />
          <meshStandardMaterial color={PLAYER_COLORS[0]} roughness={0.6} />
        </mesh>
        {/* Belt */}
        <mesh position={[0, 0.32, 0]}>
          <cylinderGeometry args={[0.29, 0.29, 0.06, 16]} />
          <meshStandardMaterial color="#2a1a00" />
        </mesh>
        {/* Head */}
        <mesh position={[0, 1.0, 0]}>
          <sphereGeometry args={[0.24, 16, 16]} />
          <meshStandardMaterial color="#f5d5a8" roughness={0.5} />
        </mesh>
        {/* Hair/hat */}
        <mesh position={[0, 1.18, 0]}>
          <sphereGeometry args={[0.26, 12, 8]} />
          <meshStandardMaterial color={PLAYER_COLORS[0]} />
        </mesh>
        <mesh position={[0, 1.12, 0.12]} rotation={[0.3, 0, 0]}>
          <cylinderGeometry args={[0.3, 0.28, 0.06, 12]} />
          <meshStandardMaterial color={PLAYER_COLORS[0]} />
        </mesh>
        {/* Eyes */}
        <mesh position={[-0.08, 1.02, 0.2]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color="#fff" />
        </mesh>
        <mesh position={[0.08, 1.02, 0.2]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color="#fff" />
        </mesh>
        <mesh position={[-0.08, 1.02, 0.24]}>
          <sphereGeometry args={[0.025, 6, 6]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        <mesh position={[0.08, 1.02, 0.24]}>
          <sphereGeometry args={[0.025, 6, 6]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        {/* Smile */}
        <mesh position={[0, 0.94, 0.22]} rotation={[0.2, 0, 0]}>
          <torusGeometry args={[0.04, 0.012, 8, 8, Math.PI]} />
          <meshStandardMaterial color="#c0785a" />
        </mesh>
        {/* Arms */}
        <mesh position={[-0.38, 0.55, 0]} rotation={[0, 0, 0.4]}>
          <capsuleGeometry args={[0.08, 0.3, 6, 8]} />
          <meshStandardMaterial color={PLAYER_COLORS[0]} roughness={0.6} />
        </mesh>
        <mesh position={[0.38, 0.55, 0]} rotation={[0, 0, -0.4]}>
          <capsuleGeometry args={[0.08, 0.3, 6, 8]} />
          <meshStandardMaterial color={PLAYER_COLORS[0]} roughness={0.6} />
        </mesh>
        {/* Hands */}
        <mesh position={[-0.48, 0.38, 0]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshStandardMaterial color="#f5d5a8" />
        </mesh>
        <mesh position={[0.48, 0.38, 0]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshStandardMaterial color="#f5d5a8" />
        </mesh>
        {/* Legs */}
        <mesh position={[-0.12, 0.12, 0]}>
          <capsuleGeometry args={[0.09, 0.18, 6, 8]} />
          <meshStandardMaterial color="#3a2a10" />
        </mesh>
        <mesh position={[0.12, 0.12, 0]}>
          <capsuleGeometry args={[0.09, 0.18, 6, 8]} />
          <meshStandardMaterial color="#3a2a10" />
        </mesh>
        {/* Shoes */}
        <mesh position={[-0.12, 0.02, 0.04]}>
          <boxGeometry args={[0.12, 0.06, 0.18]} />
          <meshStandardMaterial color="#2a1a0a" />
        </mesh>
        <mesh position={[0.12, 0.02, 0.04]}>
          <boxGeometry args={[0.12, 0.06, 0.18]} />
          <meshStandardMaterial color="#2a1a0a" />
        </mesh>
      </group>

      {/* Bot Players - improved character */}
      {botsRef.current.map((bot, i) => {
        const botColor = PLAYER_COLORS[i + 1] || '#888';
        return (
          <group key={`botG-${i}`} ref={el => { botGroupRefs.current[i] = el; }} position={[bot.x, 0, bot.z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
              <circleGeometry args={[0.45, 16]} />
              <meshStandardMaterial color="#000" transparent opacity={0.2} />
            </mesh>
            <mesh position={[0, 0.5, 0]}>
              <capsuleGeometry args={[0.28, 0.4, 12, 16]} />
              <meshStandardMaterial color={botColor} roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.32, 0]}>
              <cylinderGeometry args={[0.29, 0.29, 0.06, 16]} />
              <meshStandardMaterial color="#2a1a00" />
            </mesh>
            <mesh position={[0, 1.0, 0]}>
              <sphereGeometry args={[0.24, 16, 16]} />
              <meshStandardMaterial color="#f5d5a8" roughness={0.5} />
            </mesh>
            <mesh position={[0, 1.18, 0]}>
              <sphereGeometry args={[0.26, 12, 8]} />
              <meshStandardMaterial color={botColor} />
            </mesh>
            <mesh position={[0, 1.12, 0.12]} rotation={[0.3, 0, 0]}>
              <cylinderGeometry args={[0.3, 0.28, 0.06, 12]} />
              <meshStandardMaterial color={botColor} />
            </mesh>
            <mesh position={[-0.08, 1.02, 0.2]}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshStandardMaterial color="#fff" />
            </mesh>
            <mesh position={[0.08, 1.02, 0.2]}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshStandardMaterial color="#fff" />
            </mesh>
            <mesh position={[-0.08, 1.02, 0.24]}>
              <sphereGeometry args={[0.025, 6, 6]} />
              <meshStandardMaterial color="#222" />
            </mesh>
            <mesh position={[0.08, 1.02, 0.24]}>
              <sphereGeometry args={[0.025, 6, 6]} />
              <meshStandardMaterial color="#222" />
            </mesh>
            <mesh position={[-0.38, 0.55, 0]} rotation={[0, 0, 0.4]}>
              <capsuleGeometry args={[0.08, 0.3, 6, 8]} />
              <meshStandardMaterial color={botColor} roughness={0.6} />
            </mesh>
            <mesh position={[0.38, 0.55, 0]} rotation={[0, 0, -0.4]}>
              <capsuleGeometry args={[0.08, 0.3, 6, 8]} />
              <meshStandardMaterial color={botColor} roughness={0.6} />
            </mesh>
            <mesh position={[-0.48, 0.38, 0]}>
              <sphereGeometry args={[0.07, 8, 8]} />
              <meshStandardMaterial color="#f5d5a8" />
            </mesh>
            <mesh position={[0.48, 0.38, 0]}>
              <sphereGeometry args={[0.07, 8, 8]} />
              <meshStandardMaterial color="#f5d5a8" />
            </mesh>
            <mesh position={[-0.12, 0.12, 0]}>
              <capsuleGeometry args={[0.09, 0.18, 6, 8]} />
              <meshStandardMaterial color="#3a2a10" />
            </mesh>
            <mesh position={[0.12, 0.12, 0]}>
              <capsuleGeometry args={[0.09, 0.18, 6, 8]} />
              <meshStandardMaterial color="#3a2a10" />
            </mesh>
            <mesh position={[-0.12, 0.02, 0.04]}>
              <boxGeometry args={[0.12, 0.06, 0.18]} />
              <meshStandardMaterial color="#2a1a0a" />
            </mesh>
            <mesh position={[0.12, 0.02, 0.04]}>
              <boxGeometry args={[0.12, 0.06, 0.18]} />
              <meshStandardMaterial color="#2a1a0a" />
            </mesh>
            {config.mode === 'survival' && i === 0 && (
              <mesh position={[0, 1.4, 0]}>
                <coneGeometry args={[0.17, 0.25, 4]} />
                <meshStandardMaterial color="#ff2020" emissive="#ff0000" emissiveIntensity={0.6} />
              </mesh>
            )}
          </group>
        );
      })}

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
        camera={{ position: [0, 22, 14], fov: 50, near: 0.1, far: 120 }}
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
