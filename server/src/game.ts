import type { Server, Socket } from 'socket.io';
import type { GameSettings, KanjiEntry, Player, RoomView, StrokePayload } from '../../shared/types.js';
import { educationalReading, getEntriesForSettings } from './kanji.js';

interface TurnState {
  round: number;
  drawerId: string;
  entry: KanjiEntry;
  promptType: 'reading' | 'meaning';
  prompt: string;
  correctChoice: string;
  answer: string;
  answered: Set<string>;
  firstCorrectId?: string;
  statusMessage: string;
  secondsLeft: number;
  choicesByPlayer: Record<string, string[]>;
  timer?: NodeJS.Timeout;
}

interface RoomState {
  roomCode: string;
  phase: 'lobby' | 'playing' | 'turn-reveal' | 'results';
  players: Player[];
  settings: GameSettings;
  hostId: string;
  drawerIndex: number;
  lastDrawerId?: string;
  entries: KanjiEntry[];
  turn?: TurnState;
}

const rooms = new Map<string, RoomState>();
const playerRooms = new Map<string, string>();

const defaultSettings: GameSettings = {
  mode: 'grade',
  grade: 'grade1',
  customKanjiInput: '森, 林, 川, 山, 火, 水',
  promptMode: 'reading',
  questionFormat: 'kanji',
  roundLimit: 6,
  turnSeconds: 60,
  rescueEnabled: true,
  nextDrawerRule: 'winner'
};

function code(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 5; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return rooms.has(out) ? code() : out;
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function readingChoiceText(entry: KanjiEntry, reading = educationalReading(entry)): string {
  const displayReading = entry.readingHints?.[reading] ?? reading;
  const withoutAffixMarkers = displayReading.replace(/^-|-$/g, '');
  const dotIndex = withoutAffixMarkers.indexOf('.');
  if (dotIndex < 0) return withoutAffixMarkers;
  return `${withoutAffixMarkers.slice(0, dotIndex)}（${withoutAffixMarkers.slice(dotIndex + 1)}）`;
}

function choiceCount(player: Player, room: RoomState): number {
  if (!room.settings.rescueEnabled) return 4;
  if (player.roundsWithoutCorrect >= 3) return 2;
  if (player.score === 0) return 3;
  return 4;
}

function choicesFor(player: Player, entry: KanjiEntry, room: RoomState): string[] {
  const needed = choiceCount(player, room);
  const knownEntries = room.entries;
  const correctChoice = readingChoiceText(entry);
  const pool = Array.from(new Set(knownEntries.filter((candidate) => candidate.kanji !== entry.kanji).map((candidate) => readingChoiceText(candidate)))).filter((reading) => reading !== correctChoice);
  return shuffle([correctChoice, ...shuffle(pool).slice(0, Math.max(0, needed - 1))]);
}

function makeView(room: RoomState, socketId: string): RoomView {
  const you = room.players.find((p) => p.id === socketId);
  const isDrawer = room.turn?.drawerId === socketId;
  const turn = room.turn ? {
    round: room.turn.round,
    drawerId: room.turn.drawerId,
    drawerName: room.players.find((p) => p.id === room.turn?.drawerId)?.name ?? 'お題担当',
    promptType: room.turn.promptType,
    prompt: isDrawer ? room.turn.prompt : undefined,
    answer: room.phase === 'turn-reveal' || room.phase === 'results' || isDrawer ? room.turn.answer : undefined,
    statusMessage: room.turn.statusMessage,
    choices: !isDrawer && you ? room.turn.choicesByPlayer[socketId] : undefined,
    secondsLeft: room.turn.secondsLeft
  } : undefined;

  return {
    roomCode: room.roomCode,
    phase: room.phase,
    players: room.players.map((p) => ({ ...p })),
    settings: room.settings,
    currentTurn: turn,
    you,
    isDrawer: Boolean(isDrawer),
    canStart: room.players.length >= 2 && getEntriesForSettings(room.settings).length > 0,
    kanjiCount: getEntriesForSettings(room.settings).length
  };
}

function emitRoom(io: Server, room: RoomState): void {
  for (const player of room.players) io.to(player.id).emit('game:state', makeView(room, player.id));
}

function clearTimer(room: RoomState): void {
  if (room.turn?.timer) clearInterval(room.turn.timer);
}

function startTurn(io: Server, room: RoomState, drawerId?: string): void {
  clearTimer(room);
  room.entries = getEntriesForSettings(room.settings);
  if (room.entries.length === 0 || room.players.length === 0) return;
  if (drawerId) room.drawerIndex = Math.max(0, room.players.findIndex((p) => p.id === drawerId));
  const drawer = room.players[room.drawerIndex % room.players.length];
  const entry = pick(room.entries);
  const promptType = 'reading';
  const prompt = readingChoiceText(entry);
  const nextRound = room.turn ? room.turn.round + 1 : 1;

  room.phase = 'playing';
  room.turn = { round: nextRound, drawerId: drawer.id, entry, promptType, prompt, correctChoice: prompt, answer: entry.kanji, answered: new Set(), statusMessage: 'The drawer is writing the kanji.', secondsLeft: room.settings.turnSeconds, choicesByPlayer: {} };
  for (const player of room.players) if (player.id !== drawer.id) room.turn.choicesByPlayer[player.id] = choicesFor(player, entry, room);

  io.to(room.roomCode).emit('canvas:clear');
  room.turn.timer = setInterval(() => {
    if (!room.turn) return;
    room.turn.secondsLeft -= 1;
    if (room.turn.secondsLeft <= 0) finishTurn(io, room, undefined);
    else emitRoom(io, room);
  }, 1000);
  emitRoom(io, room);
}

function nextDrawer(room: RoomState, winnerId?: string): string | undefined {
  if (room.settings.nextDrawerRule === 'winner' && winnerId && winnerId !== room.lastDrawerId) return winnerId;
  room.drawerIndex = (room.drawerIndex + 1) % Math.max(1, room.players.length);
  return room.players[room.drawerIndex]?.id;
}

function finishTurn(io: Server, room: RoomState, winnerId?: string): void {
  if (!room.turn || room.phase !== 'playing') return;
  clearTimer(room);
  const drawer = room.players.find((p) => p.id === room.turn?.drawerId);
  const winner = winnerId ? room.players.find((p) => p.id === winnerId) : undefined;

  if (winner && drawer) {
    winner.score += 1;
    winner.correctCount += 1;
    winner.roundsWithoutCorrect = 0;
    drawer.score += 1;
    room.turn.statusMessage = winner.name + 'さん正解！';
    room.turn.firstCorrectId = winner.id;
  } else {
    room.turn.statusMessage = '時間切れ！正解は「' + room.turn.answer + '」';
  }

  for (const player of room.players) if (!winner || player.id !== winner.id) player.roundsWithoutCorrect += 1;
  room.phase = 'turn-reveal';
  room.lastDrawerId = drawer?.id;
  emitRoom(io, room);

  setTimeout(() => {
    if (room.turn && room.turn.round >= room.settings.roundLimit) {
      room.phase = 'results';
      emitRoom(io, room);
      return;
    }
    startTurn(io, room, nextDrawer(room, winner?.id));
  }, 3000);
}

export function registerGameHandlers(io: Server, socket: Socket): void {
  socket.on('room:create', ({ name }: { name: string }) => {
    const roomCode = code();
    const player: Player = { id: socket.id, name: name?.trim() || 'Player', isHost: true, connected: true, score: 0, correctCount: 0, wrongCount: 0, roundsWithoutCorrect: 0 };
    const room: RoomState = { roomCode, phase: 'lobby', players: [player], settings: { ...defaultSettings }, hostId: socket.id, drawerIndex: 0, entries: [] };
    rooms.set(roomCode, room);
    playerRooms.set(socket.id, roomCode);
    socket.join(roomCode);
    emitRoom(io, room);
  });

  socket.on('room:join', ({ name, roomCode }: { name: string; roomCode: string }) => {
    const room = rooms.get(roomCode?.trim().toUpperCase());
    if (!room) return socket.emit('app:error', 'ルームが見つかりません');
    if (room.phase !== 'lobby') return socket.emit('app:error', 'ゲーム開始後の参加はまだ対応していません');
    const player: Player = { id: socket.id, name: name?.trim() || 'Player', isHost: false, connected: true, score: 0, correctCount: 0, wrongCount: 0, roundsWithoutCorrect: 0 };
    room.players.push(player);
    playerRooms.set(socket.id, room.roomCode);
    socket.join(room.roomCode);
    emitRoom(io, room);
  });

  socket.on('settings:update', (settings: Partial<GameSettings>) => {
    const room = rooms.get(playerRooms.get(socket.id) ?? '');
    if (!room || room.hostId !== socket.id || room.phase !== 'lobby') return;
    room.settings = { ...room.settings, ...settings, promptMode: 'reading' };
    if (room.settings.mode === 'review') {
      room.settings.turnSeconds = 45;
      room.settings.roundLimit = Math.min(Math.max(room.settings.roundLimit, 1), 2);
      room.settings.rescueEnabled = true;
    }
    emitRoom(io, room);
  });

  socket.on('game:start', () => {
    const room = rooms.get(playerRooms.get(socket.id) ?? '');
    if (!room || room.hostId !== socket.id) return;
    room.entries = getEntriesForSettings(room.settings);
    if (room.players.length < 2 || room.entries.length === 0) return emitRoom(io, room);
    for (const player of room.players) Object.assign(player, { score: 0, correctCount: 0, wrongCount: 0, roundsWithoutCorrect: 0 });
    room.drawerIndex = 0;
    room.turn = undefined;
    startTurn(io, room);
  });

  socket.on('draw:stroke', (payload: StrokePayload) => {
    const room = rooms.get(playerRooms.get(socket.id) ?? '');
    if (!room || room.turn?.drawerId !== socket.id || room.phase !== 'playing') return;
    socket.to(room.roomCode).emit('draw:stroke', payload);
  });

  socket.on('canvas:clear', () => {
    const room = rooms.get(playerRooms.get(socket.id) ?? '');
    if (!room || room.turn?.drawerId !== socket.id) return;
    io.to(room.roomCode).emit('canvas:clear');
  });

  socket.on('canvas:replace', (imageData: string) => {
    const room = rooms.get(playerRooms.get(socket.id) ?? '');
    if (!room || room.turn?.drawerId !== socket.id || room.phase !== 'playing' || typeof imageData !== 'string') return;
    socket.to(room.roomCode).emit('canvas:replace', imageData);
  });

  socket.on('answer:submit', ({ choice }: { choice: string }) => {
    const room = rooms.get(playerRooms.get(socket.id) ?? '');
    if (!room || !room.turn || room.phase !== 'playing' || room.turn.drawerId === socket.id) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (!player || room.turn.firstCorrectId) return;
    room.turn.answered.add(socket.id);
    if (choice === room.turn.correctChoice) finishTurn(io, room, socket.id);
    else {
      player.wrongCount += 1;
      room.turn.statusMessage = player.name + 'さん、もう一度考えてみよう';
      emitRoom(io, room);
    }
  });

  socket.on('game:restart', () => {
    const room = rooms.get(playerRooms.get(socket.id) ?? '');
    if (!room || room.hostId !== socket.id) return;
    clearTimer(room);
    room.phase = 'lobby';
    room.turn = undefined;
    emitRoom(io, room);
  });

  socket.on('disconnect', () => {
    const room = rooms.get(playerRooms.get(socket.id) ?? '');
    if (!room) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (player) player.connected = false;
    emitRoom(io, room);
  });
}
