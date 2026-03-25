import { useState } from 'react';
import { GameConfig, GameMode, GameMapId, GAME_MODES, GAME_MAPS, DEFAULT_GAME_TIME } from '@/types/game';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface MainMenuProps {
  onStartGame: (config: GameConfig) => void;
  initialRoomCode?: string;
}

const MAX_PLAYERS = 4;

export default function MainMenu({ onStartGame }: MainMenuProps) {
  const [selectedMode, setSelectedMode] = useState<GameMode>('normal');
  const [selectedMap, setSelectedMap] = useState<GameMapId>('farm');
  const [playerName, setPlayerName] = useState('');
  const [botCount, setBotCount] = useState(3);

  const handleStart = () => {
    onStartGame({
      mode: selectedMode,
      roomCode: 'LOCAL',
      playerName: playerName || 'لاعب',
      maxTime: DEFAULT_GAME_TIME,
      botCount,
      mapId: selectedMap,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir="rtl"
      style={{ background: 'linear-gradient(135deg, #1a0a2e 0%, #16082a 40%, #0d0520 100%)' }}>
      
      {/* Decorative elements */}
      <div className="absolute inset-0 opacity-10">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="absolute text-4xl" style={{
            left: `${(i * 17 + 5) % 100}%`, top: `${(i * 23 + 10) % 100}%`,
            transform: `rotate(${i * 37}deg)`,
            opacity: 0.3 + (i % 3) * 0.15,
          }}>
            {['🐔', '✨', '🥚', '⭐', '🐣'][i % 5]}
          </div>
        ))}
      </div>

      <div className="w-full max-w-lg relative z-10">
        {/* Title */}
        <div className="text-center mb-6">
          <div className="text-7xl mb-2">🐔</div>
          <h1 className="text-5xl font-cairo font-black drop-shadow-2xl mb-1"
            style={{ color: '#FFD700', textShadow: '0 4px 20px rgba(255,215,0,0.4)' }}>
            صيد الفراخ
          </h1>
          <p className="text-lg font-cairo font-bold" style={{ color: 'rgba(255,255,255,0.6)' }}>
            من سيجمع أكثر؟ 🏆
          </p>
        </div>

        <div className="rounded-3xl p-6 shadow-2xl space-y-5 border"
          style={{ background: 'rgba(30,15,50,0.92)', borderColor: 'rgba(160,100,255,0.2)' }}>
          
          {/* Name input */}
          <Input
            placeholder="اسمك في اللعبة..."
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            className="text-center text-lg font-cairo h-12 rounded-xl bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
          />

          {/* Mode Selection */}
          <div>
            <h3 className="text-base font-cairo font-black text-foreground mb-2">🎮 اختر طور اللعبة</h3>
            <div className="grid grid-cols-2 gap-1.5 max-h-60 overflow-y-auto pr-1">
              {GAME_MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMode(m.id)}
                  className={`p-2.5 rounded-xl text-right transition-all font-cairo border ${
                    selectedMode === m.id
                      ? 'border-primary shadow-md scale-[1.02]'
                      : 'border-transparent hover:bg-muted/50'
                  }`}
                  style={selectedMode === m.id ? { background: 'rgba(160,100,255,0.15)' } : {}}
                >
                  <div className="font-bold text-sm text-foreground">{m.icon} {m.name}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Map Selection */}
          <div>
            <h3 className="text-base font-cairo font-black text-foreground mb-2">🗺️ اختر الخريطة</h3>
            <div className="grid grid-cols-3 gap-1.5">
              {GAME_MAPS.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMap(m.id)}
                  className={`p-2.5 rounded-xl text-center transition-all font-cairo border ${
                    selectedMap === m.id
                      ? 'border-primary shadow-md scale-[1.02]'
                      : 'border-transparent hover:bg-muted/50'
                  }`}
                  style={selectedMap === m.id ? { background: 'rgba(160,100,255,0.15)' } : {}}
                >
                  <div className="text-2xl mb-0.5">{m.icon}</div>
                  <div className="font-bold text-xs text-foreground">{m.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Bot count */}
          <div>
            <h3 className="text-base font-cairo font-black text-foreground mb-2">🤖 عدد البوتات</h3>
            <div className="flex gap-2">
              {[1, 2, 3].map(n => (
                <button
                  key={n}
                  onClick={() => setBotCount(n)}
                  className={`flex-1 py-2 rounded-xl font-cairo font-bold text-sm transition-all border ${
                    botCount === n
                      ? 'border-primary bg-primary/20 text-primary'
                      : 'border-transparent bg-muted/50 text-muted-foreground'
                  }`}
                >
                  {n} بوت
                </button>
              ))}
            </div>
          </div>

          {/* Players preview */}
          <div>
            <h3 className="text-base font-cairo font-black text-foreground mb-2">👥 اللاعبون</h3>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-cairo font-bold"
                style={{ background: 'rgba(231,76,60,0.2)', color: '#e74c3c' }}>
                👤 {playerName || 'أنت'}
              </div>
              {Array.from({ length: botCount }).map((_, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-xl text-sm font-cairo text-muted-foreground">
                  🤖 بوت {i + 1}
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleStart}
            className="w-full text-xl font-cairo font-black h-14 rounded-xl shadow-lg"
            style={{ background: 'linear-gradient(135deg, #FFD700, #FFA000)', color: '#3a2a00' }}>
            🚀 ابدأ اللعب!
          </Button>
        </div>
      </div>
    </div>
  );
}
