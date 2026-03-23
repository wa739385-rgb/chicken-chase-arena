import { useState, useEffect } from 'react';
import { GameConfig, GamePhase, PlayerScore, DEFAULT_GAME_TIME } from '@/types/game';
import MainMenu from '@/components/menu/MainMenu';
import GameWorld from '@/components/game/GameWorld';

export default function Index() {
  const [phase, setPhase] = useState<GamePhase>('menu');
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [finalScores, setFinalScores] = useState<PlayerScore[]>([]);

  // Check for room code in URL
  const urlRoom = new URLSearchParams(window.location.search).get('room') || undefined;

  const handleStartGame = (cfg: GameConfig) => {
    setConfig(cfg);
    setPhase('playing');
  };

  const handleGameEnd = (scores: PlayerScore[]) => {
    setFinalScores(scores);
    setPhase('menu');
  };

  if (phase === 'playing' && config) {
    return <GameWorld config={config} onGameEnd={handleGameEnd} />;
  }

  return <MainMenu onStartGame={handleStartGame} initialRoomCode={urlRoom} />;
}
