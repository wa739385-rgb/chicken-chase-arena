import { HudData, GAME_MODES, GameMode } from '@/types/game';

interface GameHUDProps {
  hudData: HudData;
  timeLeft: number;
  mode: GameMode;
  gameOver: boolean;
}

export default function GameHUD({ hudData, timeLeft, mode, gameOver }: GameHUDProps) {
  const modeInfo = GAME_MODES.find(m => m.id === mode);
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="absolute inset-0 pointer-events-none" dir="rtl">
      {/* Timer */}
      <div className="flex justify-center mt-4">
        <div className="bg-foreground/90 text-primary-foreground px-6 py-2 rounded-xl flex items-center gap-4 text-xl font-cairo font-bold shadow-lg">
          <span className="text-accent">{hudData.scores[0]?.score ?? 0}</span>
          <span className="bg-background/20 px-4 py-1 rounded-lg font-mono">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
          <span className="text-farm-sky">{hudData.scores[1]?.score ?? 0}</span>
        </div>
      </div>

      {/* Mode info */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2">
        <div className="bg-foreground/70 text-primary-foreground px-4 py-1 rounded-lg text-sm font-cairo">
          {modeInfo?.icon} {modeInfo?.name}
        </div>
      </div>

      {/* Carried chickens */}
      {hudData.localCarried > 0 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="bg-accent text-accent-foreground px-6 py-3 rounded-xl text-lg font-cairo font-bold shadow-lg animate-bounce">
            🐔 تحمل {hudData.localCarried} فرخة — عُد لقاعدتك!
          </div>
        </div>
      )}

      {/* Challenge text */}
      {hudData.challengeText && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2">
          <div className="bg-destructive text-destructive-foreground px-4 py-2 rounded-lg text-sm font-cairo font-bold animate-pulse">
            🎯 {hudData.challengeText}
          </div>
        </div>
      )}

      {/* Ability indicator */}
      {hudData.abilityReady !== undefined && (
        <div className="absolute bottom-8 right-8 pointer-events-auto">
          <div className={`px-4 py-3 rounded-xl text-sm font-cairo font-bold shadow-lg ${
            hudData.abilityReady 
              ? 'bg-primary text-primary-foreground cursor-pointer' 
              : 'bg-muted text-muted-foreground'
          }`}>
            ⚡ {hudData.abilityReady ? 'اضغط مسافة' : `انتظر ${hudData.abilityCooldown}ث`}
          </div>
        </div>
      )}

      {/* Scoreboard */}
      <div className="absolute top-4 right-4 space-y-1">
        {hudData.scores.map((s, i) => (
          <div key={i} className="flex items-center gap-2 bg-foreground/70 text-primary-foreground px-3 py-1 rounded-lg text-sm font-cairo">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
            <span>{s.name}</span>
            <span className="font-bold mr-auto">{s.score}</span>
          </div>
        ))}
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-4 left-4">
        <div className="bg-foreground/50 text-primary-foreground px-3 py-1 rounded-lg text-xs font-cairo">
          WASD أو الأسهم للحركة
        </div>
      </div>

      {/* Game Over overlay */}
      {gameOver && (
        <div className="absolute inset-0 bg-foreground/60 flex items-center justify-center pointer-events-auto">
          <div className="bg-card p-8 rounded-2xl text-center shadow-2xl">
            <h2 className="text-3xl font-cairo font-black text-accent mb-4">🏆 انتهت اللعبة!</h2>
            <div className="space-y-2 mb-6">
              {[...hudData.scores].sort((a, b) => b.score - a.score).map((s, i) => (
                <div key={i} className="flex items-center gap-3 text-lg font-cairo">
                  <span className="font-bold text-muted-foreground">#{i + 1}</span>
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-foreground">{s.name}</span>
                  <span className="font-bold text-primary mr-auto">{s.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
