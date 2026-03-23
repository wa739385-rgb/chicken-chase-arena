import { useState } from 'react';
import { GameConfig, GameMode, GAME_MODES, DEFAULT_GAME_TIME } from '@/types/game';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface MainMenuProps {
  onStartGame: (config: GameConfig) => void;
  initialRoomCode?: string;
}

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function MainMenu({ onStartGame, initialRoomCode }: MainMenuProps) {
  const [view, setView] = useState<'main' | 'create' | 'join' | 'lobby'>(initialRoomCode ? 'lobby' : 'main');
  const [selectedMode, setSelectedMode] = useState<GameMode>('normal');
  const [roomCode, setRoomCode] = useState(initialRoomCode || '');
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const handleCreate = () => {
    const code = generateRoomCode();
    setRoomCode(code);
    setView('lobby');
  };

  const handleJoin = () => {
    if (joinCode.trim()) {
      setRoomCode(joinCode.trim().toUpperCase());
      setView('lobby');
    }
  };

  const handleStart = () => {
    onStartGame({
      mode: selectedMode,
      roomCode,
      playerName: playerName || 'لاعب',
      maxTime: DEFAULT_GAME_TIME,
      botCount: 3,
    });
  };

  const shareLink = `${window.location.origin}?room=${roomCode}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/90 to-primary flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-2xl">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-6xl font-cairo font-black text-accent drop-shadow-lg mb-2">
            🐔 صيد الفراخ
          </h1>
          <p className="text-xl font-cairo text-primary-foreground/80">من سيجمع أكثر؟</p>
        </div>

        {view === 'main' && (
          <div className="bg-card/95 backdrop-blur rounded-2xl p-8 shadow-2xl space-y-4">
            <Input
              placeholder="اسمك في اللعبة..."
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              className="text-center text-lg font-cairo"
            />
            <Button onClick={handleCreate} className="w-full text-lg font-cairo font-bold py-6 bg-accent text-accent-foreground hover:bg-accent/90">
              🏠 إنشاء غرفة جديدة
            </Button>
            <Button onClick={() => setView('join')} variant="outline" className="w-full text-lg font-cairo font-bold py-6">
              🔗 الانضمام برمز
            </Button>
            <Button onClick={handleStart} variant="secondary" className="w-full text-lg font-cairo font-bold py-6">
              🎮 لعب سريع (مع بوتات)
            </Button>
          </div>
        )}

        {view === 'join' && (
          <div className="bg-card/95 backdrop-blur rounded-2xl p-8 shadow-2xl space-y-4">
            <h2 className="text-2xl font-cairo font-bold text-center text-card-foreground">الانضمام لغرفة</h2>
            <Input
              placeholder="أدخل رمز الغرفة..."
              value={joinCode}
              onChange={e => setJoinCode(e.target.value)}
              className="text-center text-2xl font-mono tracking-widest"
            />
            <div className="flex gap-3">
              <Button onClick={handleJoin} className="flex-1 text-lg font-cairo font-bold py-6 bg-accent text-accent-foreground">
                انضمام
              </Button>
              <Button onClick={() => setView('main')} variant="outline" className="text-lg font-cairo py-6">
                رجوع
              </Button>
            </div>
          </div>
        )}

        {(view === 'create' || view === 'lobby') && (
          <div className="bg-card/95 backdrop-blur rounded-2xl p-8 shadow-2xl space-y-6">
            {/* Room Code */}
            <div className="text-center">
              <p className="text-sm font-cairo text-muted-foreground mb-1">رمز الغرفة</p>
              <div className="text-4xl font-mono font-bold tracking-[0.3em] text-primary">{roomCode}</div>
              <button
                onClick={() => navigator.clipboard.writeText(shareLink)}
                className="mt-2 text-sm text-accent hover:underline font-cairo"
              >
                📋 نسخ رابط الدعوة
              </button>
            </div>

            {/* Mode Selection */}
            <div>
              <h3 className="text-lg font-cairo font-bold text-card-foreground mb-3">اختر طور اللعبة</h3>
              <div className="grid grid-cols-2 gap-2">
                {GAME_MODES.map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setSelectedMode(mode.id)}
                    className={`p-3 rounded-xl text-right transition-all font-cairo ${
                      selectedMode === mode.id
                        ? 'bg-primary text-primary-foreground shadow-lg scale-[1.02]'
                        : 'bg-muted text-muted-foreground hover:bg-accent/20'
                    }`}
                  >
                    <div className="font-bold">{mode.icon} {mode.name}</div>
                    <div className="text-xs opacity-80">{mode.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Players in lobby */}
            <div>
              <h3 className="text-lg font-cairo font-bold text-card-foreground mb-2">اللاعبون</h3>
              <div className="flex gap-2">
                <div className="bg-destructive/20 text-destructive px-3 py-1 rounded-lg text-sm font-cairo">
                  🔴 {playerName || 'أنت'}
                </div>
                <div className="bg-muted px-3 py-1 rounded-lg text-sm font-cairo text-muted-foreground">
                  🤖 بوت 1
                </div>
                <div className="bg-muted px-3 py-1 rounded-lg text-sm font-cairo text-muted-foreground">
                  🤖 بوت 2
                </div>
                <div className="bg-muted px-3 py-1 rounded-lg text-sm font-cairo text-muted-foreground">
                  🤖 بوت 3
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleStart} className="flex-1 text-xl font-cairo font-black py-6 bg-accent text-accent-foreground hover:bg-accent/90">
                🚀 ابدأ اللعبة!
              </Button>
              <Button onClick={() => setView('main')} variant="outline" className="font-cairo py-6">
                رجوع
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
