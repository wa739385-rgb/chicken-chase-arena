import { useState, useMemo } from 'react';
import { GameConfig, GamePhase, PlayerScore } from '@/types/game';
import MainMenu from '@/components/menu/MainMenu';
import GameWorld from '@/components/game/GameWorld';

export default function Index() {
  const [phase, setPhase] = useState<GamePhase>('menu');
  const [config, setConfig] = useState<GameConfig | null>(null);

  // Check for room code in URL
  const joinCode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || undefined;
  }, []);

  const handleStartGame = (cfg: GameConfig) => {
    setConfig(cfg);
    setPhase('playing');
  };

  const handleGameEnd = (_scores: PlayerScore[]) => {
    // Clear URL params
    window.history.replaceState({}, '', window.location.pathname);
    setPhase('menu');
  };

  if (phase === 'playing' && config) {
    return <GameWorld config={config} onGameEnd={handleGameEnd} />;
  }

  return <MainMenu onStartGame={handleStartGame} joinCode={joinCode} />;
}
