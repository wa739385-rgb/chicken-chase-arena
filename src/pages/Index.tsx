import { useState, useMemo, useEffect } from 'react';
import { GameConfig, GamePhase, PlayerScore, GameMode, GameMapId, DEFAULT_GAME_TIME } from '@/types/game';
import MainMenu from '@/components/menu/MainMenu';
import GameWorld from '@/components/game/GameWorld';

export default function Index() {
  const [phase, setPhase] = useState<GamePhase>('menu');
  const [config, setConfig] = useState<GameConfig | null>(null);

  // Check for room code or embed params in URL
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const joinCode = useMemo(() => params.get('room') || undefined, [params]);
  const isEmbed = useMemo(() => params.get('embed') === '1', [params]);

  // Auto-start for embed mode: ?embed=1&mode=normal&map=farm&bots=3&name=Player
  useEffect(() => {
    if (isEmbed && phase === 'menu') {
      const mode = (params.get('mode') || 'normal') as GameMode;
      const mapId = (params.get('map') || 'farm') as GameMapId;
      const botCount = parseInt(params.get('bots') || '3', 10);
      const playerName = params.get('name') || 'لاعب';
      const maxTime = parseInt(params.get('time') || String(DEFAULT_GAME_TIME), 10);
      handleStartGame({
        mode, roomCode: 'EMBED', playerName, maxTime,
        botCount: Math.min(3, Math.max(1, botCount)), mapId,
      });
    }
  }, [isEmbed]);

  const handleStartGame = (cfg: GameConfig) => {
    setConfig(cfg);
    setPhase('playing');
  };

  const handleGameEnd = (_scores: PlayerScore[]) => {
    window.history.replaceState({}, '', window.location.pathname);
    if (isEmbed) {
      // In embed mode, notify parent and restart
      try { window.parent.postMessage({ type: 'game_ended', scores: _scores }, '*'); } catch (_) {}
    }
    setPhase('menu');
  };

  if (phase === 'playing' && config) {
    return <GameWorld config={config} onGameEnd={handleGameEnd} />;
  }

  return <MainMenu onStartGame={handleStartGame} joinCode={joinCode} />;
}
