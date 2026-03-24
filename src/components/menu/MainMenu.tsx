import { useState } from 'react';
import { GameConfig, GameMode, GameMapId, GAME_MODES, GAME_MAPS, DEFAULT_GAME_TIME } from '@/types/game';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface MainMenuProps {
  onStartGame: (config: GameConfig) => void;
  initialRoomCode?: string;
}

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const MAX_PLAYERS = 4;

export default function MainMenu({ onStartGame, initialRoomCode }: MainMenuProps) {
  const [view, setView] = useState<'main' | 'join' | 'lobby'>(initialRoomCode ? 'lobby' : 'main');
  const [selectedMode, setSelectedMode] = useState<GameMode>('normal');
  const [selectedMap, setSelectedMap] = useState<GameMapId>('farm');
  const [roomCode, setRoomCode] = useState(initialRoomCode || '');
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [humanPlayers, setHumanPlayers] = useState(1);
  const [botCount, setBotCount] = useState(3);

  const remainingSlots = MAX_PLAYERS - humanPlayers;

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
      roomCode: roomCode || generateRoomCode(),
      playerName: playerName || 'لاعب',
      maxTime: DEFAULT_GAME_TIME,
      botCount,
      mapId: selectedMap,
    });
  };

  const shareLink = `${window.location.origin}?room=${roomCode}`;

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir="rtl"
      style={{ background: 'linear-gradient(135deg, #1a0a2e 0%, #16082a 40%, #0d0520 100%)' }}>
      
      {/* Decorative elements */}
      <div className="absolute inset-0 opacity-10">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="absolute text-4xl" style={{
            left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
            transform: `rotate(${Math.random() * 360}deg)`,
            opacity: 0.3 + Math.random() * 0.4,
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

        {view === 'main' && (
          <div className="rounded-3xl p-6 shadow-2xl space-y-3 border"
            style={{ background: 'rgba(30,15,50,0.92)', borderColor: 'rgba(160,100,255,0.2)' }}>
            <Input
              placeholder="اسمك في اللعبة..."
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              className="text-center text-lg font-cairo h-12 rounded-xl bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
            />
            <Button onClick={handleCreate}
              className="w-full text-lg font-cairo font-black h-14 rounded-xl shadow-lg"
              style={{ background: 'linear-gradient(135deg, #FFD700, #FFA000)', color: '#3a2a00' }}>
              🏠 إنشاء غرفة جديدة
            </Button>
            <Button onClick={() => setView('join')}
              variant="outline"
              className="w-full text-lg font-cairo font-bold h-14 rounded-xl border-primary/40 text-foreground hover:bg-primary/10">
              🔗 الانضمام برمز أو رابط
            </Button>
          </div>
        )}

        {view === 'join' && (
          <div className="rounded-3xl p-6 shadow-2xl space-y-4 border"
            style={{ background: 'rgba(30,15,50,0.92)', borderColor: 'rgba(160,100,255,0.2)' }}>
            <h2 className="text-2xl font-cairo font-black text-center text-foreground">الانضمام لغرفة</h2>
            <Input
              placeholder="اسمك..."
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              className="text-center text-lg font-cairo h-12 rounded-xl bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
            />
            <Input
              placeholder="أدخل رمز الغرفة..."
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              className="text-center text-3xl font-mono tracking-[0.4em] h-16 rounded-xl bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              maxLength={6}
            />
            <div className="flex gap-3">
              <Button onClick={handleJoin} disabled={joinCode.length < 4}
                className="flex-1 text-lg font-cairo font-black h-14 rounded-xl"
                style={{ background: 'linear-gradient(135deg, #FFD700, #FFA000)', color: '#3a2a00' }}>
                ✅ انضمام
              </Button>
              <Button onClick={() => setView('main')} variant="outline" className="font-cairo h-14 rounded-xl px-6 border-primary/40 text-foreground hover:bg-primary/10">
                ↩️
              </Button>
            </div>
          </div>
        )}

        {view === 'lobby' && (
          <div className="rounded-3xl p-6 shadow-2xl space-y-5 border"
            style={{ background: 'rgba(30,15,50,0.92)', borderColor: 'rgba(160,100,255,0.2)' }}>
            {/* Name input */}
            {!playerName && (
              <Input
                placeholder="أدخل اسمك..."
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                className="text-center text-lg font-cairo h-12 rounded-xl bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              />
            )}

            {/* Room Code */}
            <div className="text-center p-4 rounded-2xl" style={{ background: 'rgba(160,100,255,0.08)' }}>
              <p className="text-xs font-cairo text-muted-foreground mb-1">رمز الغرفة</p>
              <div className="text-4xl font-mono font-black tracking-[0.4em] text-primary">{roomCode}</div>
              <button onClick={copyLink}
                className="mt-2 text-sm font-cairo font-bold transition-colors"
                style={{ color: copied ? '#2ecc71' : '#FFD700' }}>
                {copied ? '✅ تم النسخ!' : '📋 نسخ رابط الدعوة'}
              </button>
              <p className="text-xs font-cairo text-muted-foreground mt-1">
                شارك الرابط مع أصدقائك للانضمام مباشرة
              </p>
            </div>

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
              <div className="grid grid-cols-4 gap-1.5">
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

            {/* Bot count - dynamic based on remaining slots */}
            <div>
              <h3 className="text-base font-cairo font-black text-foreground mb-2">🤖 بوتات لتعبئة الأماكن ({remainingSlots} مكان متبقي)</h3>
              <div className="flex gap-2">
                {Array.from({ length: remainingSlots + 1 }, (_, n) => n).map(n => (
                  <button
                    key={n}
                    onClick={() => setBotCount(n)}
                    className={`flex-1 py-2 rounded-xl font-cairo font-bold text-sm transition-all border ${
                      botCount === n
                        ? 'border-primary bg-primary/20 text-primary'
                        : 'border-transparent bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    {n === 0 ? 'بدون' : `${n} بوت`}
                  </button>
                ))}
              </div>
            </div>

            {/* Players */}
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

            <div className="flex gap-3">
              <Button onClick={handleStart}
                disabled={!playerName.trim()}
                className="flex-1 text-xl font-cairo font-black h-14 rounded-xl shadow-lg disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #FFD700, #FFA000)', color: '#3a2a00' }}>
                🚀 ابدأ!
              </Button>
              <Button onClick={() => setView('main')} variant="outline" className="font-cairo h-14 rounded-xl px-5 border-primary/40 text-foreground hover:bg-primary/10">
                ↩️
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
