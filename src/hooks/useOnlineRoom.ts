import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameConfig, GameMode, GameMapId } from '@/types/game';

export interface RoomPlayer {
  id: string;
  player_name: string;
  session_id: string;
  is_host: boolean;
}

export interface TournamentRound {
  mode: GameMode;
  mapId: GameMapId;
}

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getSessionId(): string {
  let sid = sessionStorage.getItem('game_session_id');
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem('game_session_id', sid);
  }
  return sid;
}

export function useOnlineRoom() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const [tournamentConfig, setTournamentConfig] = useState<TournamentRound[] | null>(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [error, setError] = useState<string>('');
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const sessionId = getSessionId();

  // Subscribe to room changes via Realtime
  const subscribeToRoom = useCallback((rId: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase.channel(`room:${rId}`, {
      config: { broadcast: { self: true } },
    });

    channel
      .on('broadcast', { event: 'game_start' }, (payload) => {
        setGameConfig(payload.payload.config as GameConfig);
        setTournamentConfig(payload.payload.tournament || null);
        setCurrentRound(payload.payload.currentRound || 0);
        setGameStarted(true);
      })
      .on('broadcast', { event: 'player_update' }, () => {
        // Refresh players list
        fetchPlayers(rId);
      })
      .subscribe();

    channelRef.current = channel;
  }, []);

  const fetchPlayers = async (rId: string) => {
    const { data } = await supabase
      .from('room_players')
      .select('*')
      .eq('room_id', rId)
      .order('joined_at', { ascending: true });
    if (data) {
      setPlayers(data.map(p => ({
        id: p.id,
        player_name: p.player_name,
        session_id: p.session_id,
        is_host: p.is_host || false,
      })));
    }
  };

  const createRoom = async (hostName: string): Promise<string | null> => {
    const code = generateRoomCode();
    const { data, error: err } = await supabase
      .from('game_rooms')
      .insert({ room_code: code, host_name: hostName, status: 'waiting' })
      .select()
      .single();

    if (err || !data) {
      setError('فشل إنشاء الغرفة');
      return null;
    }

    // Add host as player
    await supabase.from('room_players').insert({
      room_id: data.id,
      player_name: hostName,
      session_id: sessionId,
      is_host: true,
    });

    setRoomId(data.id);
    setRoomCode(code);
    setIsHost(true);
    subscribeToRoom(data.id);
    await fetchPlayers(data.id);
    return code;
  };

  const joinRoom = async (code: string, playerName: string): Promise<boolean> => {
    const { data: room } = await supabase
      .from('game_rooms')
      .select('*')
      .eq('room_code', code.toUpperCase())
      .maybeSingle();

    if (!room) {
      setError('الغرفة غير موجودة');
      return false;
    }

    if (room.status !== 'waiting') {
      setError('اللعبة بدأت بالفعل');
      return false;
    }

    // Check player count
    const { count } = await supabase
      .from('room_players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id);

    if ((count || 0) >= (room.max_players || 4)) {
      setError('الغرفة ممتلئة');
      return false;
    }

    // Check if already in room
    const { data: existing } = await supabase
      .from('room_players')
      .select('id')
      .eq('room_id', room.id)
      .eq('session_id', sessionId)
      .maybeSingle();

    if (!existing) {
      await supabase.from('room_players').insert({
        room_id: room.id,
        player_name: playerName,
        session_id: sessionId,
        is_host: false,
      });
    }

    setRoomId(room.id);
    setRoomCode(code.toUpperCase());
    setIsHost(false);
    subscribeToRoom(room.id);
    await fetchPlayers(room.id);

    // Notify others
    channelRef.current?.send({
      type: 'broadcast',
      event: 'player_update',
      payload: {},
    });

    return true;
  };

  const startGame = async (config: GameConfig, tournament?: TournamentRound[]) => {
    if (!roomId || !isHost) return;

    await supabase
      .from('game_rooms')
      .update({
        status: 'playing',
        game_config: config as any,
        tournament_config: tournament ? (tournament as any) : null,
      })
      .eq('id', roomId);

    channelRef.current?.send({
      type: 'broadcast',
      event: 'game_start',
      payload: {
        config,
        tournament: tournament || null,
        currentRound: 0,
      },
    });
  };

  const leaveRoom = async () => {
    if (roomId) {
      await supabase
        .from('room_players')
        .delete()
        .eq('room_id', roomId)
        .eq('session_id', sessionId);

      if (isHost) {
        await supabase.from('game_rooms').delete().eq('id', roomId);
      }

      channelRef.current?.send({
        type: 'broadcast',
        event: 'player_update',
        payload: {},
      });
    }

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setRoomId(null);
    setRoomCode('');
    setPlayers([]);
    setIsHost(false);
    setGameStarted(false);
    setGameConfig(null);
    setError('');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  // Poll players every 3s when in a room
  useEffect(() => {
    if (!roomId) return;
    const interval = setInterval(() => fetchPlayers(roomId), 3000);
    return () => clearInterval(interval);
  }, [roomId]);

  return {
    roomId, roomCode, players, isHost, gameStarted, gameConfig,
    tournamentConfig, currentRound, error,
    createRoom, joinRoom, startGame, leaveRoom, sessionId,
    setError,
  };
}
