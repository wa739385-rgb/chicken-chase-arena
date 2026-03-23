import { HudData, GAME_MODES, GameMode, ABILITY_NAMES } from '@/types/game';

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
  const sorted = [...hudData.scores].sort((a, b) => b.score - a.score);

  return (
    <div className="absolute inset-0 pointer-events-none font-cairo" dir="rtl">
      {/* Top Bar */}
      <div className="flex justify-center mt-3">
        <div className="bg-foreground/85 backdrop-blur-sm text-primary-foreground px-5 py-2 rounded-2xl flex items-center gap-3 text-lg font-bold shadow-xl border border-primary-foreground/10">
          {hudData.scores[0] && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: hudData.scores[0].color }} />
              <span>{hudData.scores[0].score}</span>
            </div>
          )}
          <div className="bg-background/20 px-4 py-1 rounded-xl font-mono text-xl tabular-nums">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>
          {hudData.scores[1] && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: hudData.scores[1].color }} />
              <span>{hudData.scores[1].score}</span>
            </div>
          )}
        </div>
      </div>

      {/* Mode Badge */}
      <div className="flex justify-center mt-2">
        <div className="bg-primary/80 text-primary-foreground px-3 py-0.5 rounded-full text-xs font-bold">
          {modeInfo?.icon} {modeInfo?.name}
        </div>
      </div>

      {/* Notification */}
      {hudData.modeInfo && (
        <div className="flex justify-center mt-3">
          <div className="bg-accent text-accent-foreground px-5 py-2 rounded-xl text-base font-bold shadow-lg animate-bounce">
            {hudData.modeInfo}
          </div>
        </div>
      )}

      {/* Carried indicator */}
      {hudData.localCarried > 0 && !hudData.modeInfo && (
        <div className="flex justify-center mt-3">
          <div className="bg-accent/90 text-accent-foreground px-5 py-2 rounded-xl text-base font-bold shadow-lg">
            🐔 تحمل فرخة! عُد لقاعدتك 🏠
          </div>
        </div>
      )}

      {/* Challenge text */}
      {hudData.challengeText && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2">
          <div className="bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-xl text-sm font-bold animate-pulse shadow-lg">
            🎯 {hudData.challengeText}
          </div>
        </div>
      )}

      {/* Ability */}
      {hudData.abilityReady !== undefined && (
        <div className="absolute bottom-6 right-6 pointer-events-auto">
          <div className={`px-4 py-3 rounded-xl font-bold shadow-xl transition-all ${
            hudData.abilityReady
              ? 'bg-accent text-accent-foreground scale-110'
              : 'bg-muted text-muted-foreground'
          }`}>
            ⚡ {hudData.abilityReady ? `مسافة = ${hudData.abilityType ? ABILITY_NAMES[hudData.abilityType] : 'قدرة'}!` : `${hudData.abilityCooldown}ث`}
          </div>
        </div>
      )}

      {/* Scoreboard */}
      <div className="absolute top-4 right-4 space-y-1">
        {sorted.map((s, i) => (
          <div key={s.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold shadow ${
            i === 0 ? 'bg-accent/90 text-accent-foreground' : 'bg-foreground/70 text-primary-foreground'
          }`}>
            <span className="text-xs opacity-60">#{i + 1}</span>
            <div className="w-3 h-3 rounded-full border border-primary-foreground/30" style={{ backgroundColor: s.color }} />
            <span>{s.name}</span>
            <span className="mr-auto tabular-nums">{s.score}</span>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="absolute bottom-3 left-3">
        <div className="bg-foreground/40 text-primary-foreground px-3 py-1 rounded-lg text-xs">
          ⌨️ WASD / الأسهم للحركة
        </div>
      </div>

      {/* Game Over */}
      {gameOver && (
        <div className="absolute inset-0 bg-foreground/70 backdrop-blur-sm flex items-center justify-center pointer-events-auto">
          <div className="bg-card p-8 rounded-3xl text-center shadow-2xl max-w-sm w-full mx-4 border border-border">
            <div className="text-5xl mb-3">🏆</div>
            <h2 className="text-3xl font-black text-accent mb-1">انتهت اللعبة!</h2>
            <p className="text-muted-foreground mb-5">
              الفائز: <span className="font-bold text-foreground">{sorted[0]?.name}</span> بـ {sorted[0]?.score} نقطة
            </p>
            <div className="space-y-2 mb-4">
              {sorted.map((s, i) => (
                <div key={s.id} className={`flex items-center gap-3 p-3 rounded-xl ${
                  i === 0 ? 'bg-accent/20 border border-accent/30' : 'bg-muted/50'
                }`}>
                  <span className="text-2xl">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🏅'}</span>
                  <div className="w-5 h-5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="font-bold text-foreground">{s.name}</span>
                  <span className="font-black text-primary mr-auto text-lg">{s.score}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">العودة للقائمة خلال ثوانٍ...</p>
          </div>
        </div>
      )}
    </div>
  );
}
