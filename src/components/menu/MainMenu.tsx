import { useState, useEffect } from 'react';
import { GameConfig, GameMode, GameMapId, GAME_MODES, GAME_MAPS, DEFAULT_GAME_TIME, OnlinePlayerInfo } from '@/types/game';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useOnlineRoom, TournamentRound } from '@/hooks/useOnlineRoom';

interface MainMenuProps {
  onStartGame: (config: GameConfig) => void;
  joinCode?: string;
}

export default function MainMenu({ onStartGame, joinCode }: MainMenuProps) {
  const [tab, setTab] = useState<'offline' | 'online'>(joinCode ? 'online' : 'offline');
  const [selectedMode, setSelectedMode] = useState<GameMode>('normal');
  const [selectedMap, setSelectedMap] = useState<GameMapId>('farm');
  const [playerName, setPlayerName] = useState('');
  const [botCount, setBotCount] = useState(3);

  // Online state
  const [onlineView, setOnlineView] = useState<'choice' | 'create' | 'join' | 'lobby'>(joinCode ? 'join' : 'choice');
  const [joinInput, setJoinInput] = useState(joinCode || '');
  const [joinName, setJoinName] = useState('');
  const room = useOnlineRoom();

  // Tournament mode
  const [isTournament, setIsTournament] = useState(false);
  const [tournamentRounds, setTournamentRounds] = useState<TournamentRound[]>([
    { mode: 'normal', mapId: 'farm' },
    { mode: 'theft', mapId: 'desert' },
    { mode: 'invisible', mapId: 'night' },
    { mode: 'king', mapId: 'snow' },
    { mode: 'survival', mapId: 'volcano' },
  ]);

  // Auto-join if joinCode provided
  useEffect(() => {
    if (joinCode && joinName) {
      // will be handled by join button
    }
  }, [joinCode]);

  // When game starts online
  useEffect(() => {
    if (room.gameStarted && room.gameConfig) {
      // For non-host players, set their playerIndex based on their session
      const cfg = { ...room.gameConfig };
      if (cfg.onlinePlayers) {
        const myIdx = cfg.onlinePlayers.findIndex(p => p.sessionId === room.sessionId);
        if (myIdx >= 0) {
          cfg.playerIndex = myIdx;
          cfg.playerName = cfg.onlinePlayers[myIdx].name;
        }
      }
      cfg.isOnline = true;
      cfg.supabaseRoomId = room.roomId || undefined;
      onStartGame(cfg);
    }
  }, [room.gameStarted, room.gameConfig]);

  const handleOfflineStart = () => {
    onStartGame({
      mode: selectedMode,
      roomCode: 'LOCAL',
      playerName: playerName || 'لاعب',
      maxTime: DEFAULT_GAME_TIME,
      botCount,
      mapId: selectedMap,
    });
  };

  const handleCreateRoom = async () => {
    const name = playerName || 'الخادم';
    const code = await room.createRoom(name);
    if (code) setOnlineView('lobby');
  };

  const handleJoinRoom = async () => {
    const name = joinName || 'لاعب';
    const ok = await room.joinRoom(joinInput, name);
    if (ok) setOnlineView('lobby');
  };

  const handleStartOnlineGame = () => {
    const botSlots = Math.max(0, 4 - room.players.length);
    const onlinePlayers = room.players.map((p, i) => ({
      sessionId: p.session_id,
      name: p.player_name,
      index: i,
    }));
    const myIndex = room.players.findIndex(p => p.session_id === room.sessionId);
    const config: GameConfig = {
      mode: isTournament ? tournamentRounds[0].mode : selectedMode,
      roomCode: room.roomCode,
      playerName: playerName || 'الخادم',
      maxTime: DEFAULT_GAME_TIME,
      botCount: botSlots,
      mapId: isTournament ? tournamentRounds[0].mapId : selectedMap,
      playerIndex: myIndex >= 0 ? myIndex : 0,
      onlinePlayers,
      isOnline: true,
      supabaseRoomId: room.roomId || undefined,
    };
    room.startGame(config, isTournament ? tournamentRounds : undefined);
  };

  const copyInviteLink = () => {
    const url = `${window.location.origin}?room=${room.roomCode}`;
    navigator.clipboard.writeText(url);
  };

  const updateTournamentRound = (idx: number, field: 'mode' | 'mapId', value: string) => {
    setTournamentRounds(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const decorEmojis = ['🐔', '✨', '🥚', '⭐', '🐣'];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir="rtl"
      style={{ background: 'linear-gradient(135deg, #1a0a2e 0%, #16082a 40%, #0d0520 100%)' }}>
      
      {/* Decorative elements */}
      <div className="absolute inset-0 opacity-10">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="absolute text-4xl" style={{
            left: `${(i * 17 + 5) % 100}%`, top: `${(i * 23 + 10) % 100}%`,
            transform: `rotate(${i * 37}deg)`, opacity: 0.3 + (i % 3) * 0.15,
          }}>
            {decorEmojis[i % 5]}
          </div>
        ))}
      </div>

      <div className="w-full max-w-lg relative z-10">
        {/* Title */}
        <div className="text-center mb-4">
          <div className="text-7xl mb-2">🐔</div>
          <h1 className="text-5xl font-cairo font-black drop-shadow-2xl mb-1"
            style={{ color: '#FFD700', textShadow: '0 4px 20px rgba(255,215,0,0.4)' }}>
            صيد الفراخ
          </h1>
          <p className="text-lg font-cairo font-bold" style={{ color: 'rgba(255,255,255,0.6)' }}>
            من سيجمع أكثر؟ 🏆
          </p>
        </div>

        <div className="rounded-3xl p-5 shadow-2xl border"
          style={{ background: 'rgba(30,15,50,0.92)', borderColor: 'rgba(160,100,255,0.2)' }}>

          {/* Tab Toggle: Online / Offline */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => { setTab('online'); setOnlineView('choice'); }}
              className={`flex-1 py-2.5 rounded-xl font-cairo font-bold text-sm transition-all border ${
                tab === 'online'
                  ? 'border-primary bg-primary/20 text-primary'
                  : 'border-transparent bg-muted/50 text-muted-foreground'
              }`}
            >
              🌐 أونلاين
            </button>
            <button
              onClick={() => setTab('offline')}
              className={`flex-1 py-2.5 rounded-xl font-cairo font-bold text-sm transition-all border ${
                tab === 'offline'
                  ? 'border-primary bg-primary/20 text-primary'
                  : 'border-transparent bg-muted/50 text-muted-foreground'
              }`}
            >
              🤖 مع بوتات
            </button>
          </div>

          {/* ─── ONLINE TAB ─── */}
          {tab === 'online' && (
            <>
              {onlineView === 'choice' && (
                <div className="space-y-3">
                  <Input
                    placeholder="اكتب اسمك..."
                    value={playerName}
                    onChange={e => setPlayerName(e.target.value)}
                    className="text-center text-lg font-cairo h-12 rounded-xl bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
                  />
                  <Button onClick={handleCreateRoom}
                    className="w-full text-lg font-cairo font-black h-12 rounded-xl"
                    style={{ background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)', color: '#fff' }}>
                    🏠 إنشاء غرفة
                  </Button>
                  <div className="text-center text-muted-foreground font-cairo text-sm">أو</div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="رمز الغرفة..."
                      value={joinInput}
                      onChange={e => setJoinInput(e.target.value.toUpperCase())}
                      className="text-center text-lg font-cairo h-12 rounded-xl bg-muted/50 border-border text-foreground placeholder:text-muted-foreground flex-1"
                      maxLength={6}
                    />
                    <Button onClick={() => setOnlineView('join')}
                      className="h-12 px-6 rounded-xl font-cairo font-bold"
                      style={{ background: 'linear-gradient(135deg, #FFD700, #FFA000)', color: '#3a2a00' }}
                      disabled={!joinInput.trim()}>
                      انضم
                    </Button>
                  </div>
                </div>
              )}

              {onlineView === 'join' && (
                <div className="space-y-3">
                  <h3 className="text-base font-cairo font-black text-foreground text-center">
                    🎮 انضم للغرفة: {joinInput}
                  </h3>
                  <Input
                    placeholder="اكتب اسمك..."
                    value={joinName}
                    onChange={e => setJoinName(e.target.value)}
                    className="text-center text-lg font-cairo h-12 rounded-xl bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
                    autoFocus
                  />
                  {room.error && (
                    <p className="text-destructive text-center text-sm font-cairo">{room.error}</p>
                  )}
                  <Button onClick={handleJoinRoom}
                    className="w-full text-lg font-cairo font-black h-12 rounded-xl"
                    style={{ background: 'linear-gradient(135deg, #FFD700, #FFA000)', color: '#3a2a00' }}
                    disabled={!joinName.trim()}>
                    ✅ موافق
                  </Button>
                  <button onClick={() => { setOnlineView('choice'); room.setError(''); }}
                    className="w-full text-sm text-muted-foreground font-cairo hover:text-foreground">
                    ← رجوع
                  </button>
                </div>
              )}

              {onlineView === 'lobby' && (
                <div className="space-y-4">
                  {/* Room code & invite */}
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground font-cairo mb-1">رمز الغرفة</p>
                    <div className="text-3xl font-mono font-black text-primary tracking-widest">{room.roomCode}</div>
                    <button onClick={copyInviteLink}
                      className="mt-2 text-sm font-cairo px-4 py-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-all">
                      📋 نسخ رابط الدعوة
                    </button>
                  </div>

                  {/* Players list */}
                  <div>
                    <h3 className="text-base font-cairo font-black text-foreground mb-2">
                      👥 اللاعبون ({room.players.length}/4)
                    </h3>
                    <div className="space-y-1.5">
                      {room.players.map((p, i) => (
                        <div key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/30 font-cairo text-sm">
                          <span className="text-lg">{p.is_host ? '👑' : '👤'}</span>
                          <span className="text-foreground font-bold">{p.player_name}</span>
                          {p.session_id === room.sessionId && (
                            <span className="text-xs text-primary mr-auto">(أنت)</span>
                          )}
                        </div>
                      ))}
                      {room.players.length < 4 && (
                        <div className="text-center text-xs text-muted-foreground font-cairo py-1">
                          ⏳ في انتظار لاعبين... ({4 - room.players.length} أماكن متبقية)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Host controls */}
                  {room.isHost && (
                    <>
                      {/* Tournament toggle */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setIsTournament(false)}
                          className={`flex-1 py-2 rounded-xl font-cairo font-bold text-sm border ${
                            !isTournament ? 'border-primary bg-primary/20 text-primary' : 'border-transparent bg-muted/50 text-muted-foreground'
                          }`}>
                          🎮 لعبة واحدة
                        </button>
                        <button
                          onClick={() => setIsTournament(true)}
                          className={`flex-1 py-2 rounded-xl font-cairo font-bold text-sm border ${
                            isTournament ? 'border-primary bg-primary/20 text-primary' : 'border-transparent bg-muted/50 text-muted-foreground'
                          }`}>
                          🏆 بطولة (5 جولات)
                        </button>
                      </div>

                      {!isTournament ? (
                        <>
                          {/* Single game config */}
                          <div>
                            <h3 className="text-sm font-cairo font-black text-foreground mb-1.5">🎮 الطور</h3>
                            <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                              {GAME_MODES.map(m => (
                                <button key={m.id} onClick={() => setSelectedMode(m.id)}
                                  className={`p-2 rounded-xl text-right transition-all font-cairo border ${
                                    selectedMode === m.id ? 'border-primary shadow-md' : 'border-transparent hover:bg-muted/50'
                                  }`}
                                  style={selectedMode === m.id ? { background: 'rgba(160,100,255,0.15)' } : {}}>
                                  <div className="font-bold text-xs text-foreground">{m.icon} {m.name}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h3 className="text-sm font-cairo font-black text-foreground mb-1.5">🗺️ الخريطة</h3>
                            <div className="grid grid-cols-3 gap-1.5">
                              {GAME_MAPS.map(m => (
                                <button key={m.id} onClick={() => setSelectedMap(m.id)}
                                  className={`p-2 rounded-xl text-center transition-all font-cairo border ${
                                    selectedMap === m.id ? 'border-primary shadow-md' : 'border-transparent hover:bg-muted/50'
                                  }`}
                                  style={selectedMap === m.id ? { background: 'rgba(160,100,255,0.15)' } : {}}>
                                  <div className="text-xl">{m.icon}</div>
                                  <div className="font-bold text-[10px] text-foreground">{m.name}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : (
                        /* Tournament rounds config */
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          <h3 className="text-sm font-cairo font-black text-foreground">🏆 جولات البطولة</h3>
                          {tournamentRounds.map((round, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-muted/30">
                              <span className="text-sm font-cairo font-bold text-primary min-w-[24px]">{idx + 1}</span>
                              <select value={round.mode} onChange={e => updateTournamentRound(idx, 'mode', e.target.value)}
                                className="flex-1 bg-muted/50 text-foreground rounded-lg px-2 py-1 text-xs font-cairo border border-border">
                                {GAME_MODES.map(m => (
                                  <option key={m.id} value={m.id}>{m.icon} {m.name}</option>
                                ))}
                              </select>
                              <select value={round.mapId} onChange={e => updateTournamentRound(idx, 'mapId', e.target.value)}
                                className="w-24 bg-muted/50 text-foreground rounded-lg px-2 py-1 text-xs font-cairo border border-border">
                                {GAME_MAPS.map(m => (
                                  <option key={m.id} value={m.id}>{m.icon} {m.name}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      )}

                      <Button onClick={handleStartOnlineGame}
                        className="w-full text-xl font-cairo font-black h-14 rounded-xl shadow-lg"
                        style={{ background: 'linear-gradient(135deg, #FFD700, #FFA000)', color: '#3a2a00' }}>
                        🚀 ابدأ اللعب!
                      </Button>
                    </>
                  )}

                  {!room.isHost && (
                    <div className="text-center py-4">
                      <div className="text-4xl mb-2 animate-bounce">⏳</div>
                      <p className="text-muted-foreground font-cairo">في انتظار الخادم لبدء اللعبة...</p>
                    </div>
                  )}

                  <button onClick={() => { room.leaveRoom(); setOnlineView('choice'); }}
                    className="w-full text-sm text-muted-foreground font-cairo hover:text-destructive transition-all">
                    🚪 مغادرة الغرفة
                  </button>
                </div>
              )}
            </>
          )}

          {/* ─── OFFLINE TAB ─── */}
          {tab === 'offline' && (
            <div className="space-y-4">
              <Input
                placeholder="اسمك في اللعبة..."
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                className="text-center text-lg font-cairo h-12 rounded-xl bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
              />

              {/* Mode */}
              <div>
                <h3 className="text-sm font-cairo font-black text-foreground mb-1.5">🎮 الطور</h3>
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {GAME_MODES.map(m => (
                    <button key={m.id} onClick={() => setSelectedMode(m.id)}
                      className={`p-2 rounded-xl text-right transition-all font-cairo border ${
                        selectedMode === m.id ? 'border-primary shadow-md' : 'border-transparent hover:bg-muted/50'
                      }`}
                      style={selectedMode === m.id ? { background: 'rgba(160,100,255,0.15)' } : {}}>
                      <div className="font-bold text-xs text-foreground">{m.icon} {m.name}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Map */}
              <div>
                <h3 className="text-sm font-cairo font-black text-foreground mb-1.5">🗺️ الخريطة</h3>
                <div className="grid grid-cols-3 gap-1.5">
                  {GAME_MAPS.map(m => (
                    <button key={m.id} onClick={() => setSelectedMap(m.id)}
                      className={`p-2 rounded-xl text-center transition-all font-cairo border ${
                        selectedMap === m.id ? 'border-primary shadow-md' : 'border-transparent hover:bg-muted/50'
                      }`}
                      style={selectedMap === m.id ? { background: 'rgba(160,100,255,0.15)' } : {}}>
                      <div className="text-xl">{m.icon}</div>
                      <div className="font-bold text-[10px] text-foreground">{m.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bot count */}
              <div>
                <h3 className="text-sm font-cairo font-black text-foreground mb-1.5">🤖 عدد البوتات</h3>
                <div className="flex gap-2">
                  {[1, 2, 3].map(n => (
                    <button key={n} onClick={() => setBotCount(n)}
                      className={`flex-1 py-2 rounded-xl font-cairo font-bold text-sm border ${
                        botCount === n ? 'border-primary bg-primary/20 text-primary' : 'border-transparent bg-muted/50 text-muted-foreground'
                      }`}>
                      {n} بوت
                    </button>
                  ))}
                </div>
              </div>

              <Button onClick={handleOfflineStart}
                className="w-full text-xl font-cairo font-black h-14 rounded-xl shadow-lg"
                style={{ background: 'linear-gradient(135deg, #FFD700, #FFA000)', color: '#3a2a00' }}>
                🚀 ابدأ اللعب!
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
