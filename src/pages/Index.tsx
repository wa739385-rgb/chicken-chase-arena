import { useState } from 'react';
import { GameConfig, GamePhase, PlayerScore } from '@/types/game';
import MainMenu from '@/components/menu/MainMenu';
import GameWorld from '@/components/game/GameWorld';

export default function Index() {
  const [phase, setPhase] = useState<GamePhase>('menu');
  const [config, setConfig] = useState<GameConfig | null>(null);

  // Check for room code in URL
  const params = new URLSearchParams(window.location.search);
  const urlRoom = params.get('room') || undefined;

  const handleStartGame = (cfg: GameConfig) => {
    setConfig(cfg);
    setPhase('playing');
    // Clean URL after joining
    if (window.location.search) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  const handleGameEnd = (_scores: PlayerScore[]) => {
    setPhase('menu');
  };

  if (phase === 'playing' && config) {
    return <GameWorld config={config} onGameEnd={handleGameEnd} />;
  }

  return <MainMenu onStartGame={handleStartGame} initialRoomCode={urlRoom} />;
}
