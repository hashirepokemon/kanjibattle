export type Screen = 'home' | 'lobby' | 'game' | 'results';
export type GamePhase = 'lobby' | 'playing' | 'turn-reveal' | 'results';
export type PromptMode = 'reading' | 'meaning' | 'random';
export type QuestionFormat = 'kanji' | 'vocabulary' | 'mixed';
export type GameMode = 'grade' | 'custom' | 'review';
export type GradeKey = 'grade1' | 'grade2' | 'grade3' | 'grade4' | 'grade5' | 'grade6' | 'juniorHigh' | 'advanced' | 'jlptN5' | 'jlptN4' | 'jlptN3' | 'jlptN2' | 'jlptN1';
export type NextDrawerRule = 'winner' | 'order';

export interface KanjiEntry {
  kanji: string;
  reading: string[];
  meaning: string[];
  grade: number | string;
  onyomi: string[];
  kunyomi: string[];
  readingHints?: Record<string, string>;
  promptTypes: Array<'reading' | 'meaning'>;
  distractors: string[];
}

export interface PlayerStats {
  score: number;
  correctCount: number;
  wrongCount: number;
  roundsWithoutCorrect: number;
}

export interface Player extends PlayerStats {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
}

export interface GameSettings {
  mode: GameMode;
  grade: GradeKey;
  customKanjiInput: string;
  promptMode: PromptMode;
  questionFormat: QuestionFormat;
  roundLimit: number;
  turnSeconds: number;
  rescueEnabled: boolean;
  nextDrawerRule: NextDrawerRule;
}

export interface PublicTurn {
  round: number;
  drawerId: string;
  drawerName: string;
  promptType: 'reading' | 'meaning';
  prompt?: string;
  answer?: string;
  correctChoice?: string;
  statusMessage: string;
  choices?: string[];
  answerLocked?: boolean;
  secondsLeft: number;
}

export interface RoomView {
  roomCode: string;
  phase: GamePhase;
  players: Player[];
  settings: GameSettings;
  currentTurn?: PublicTurn;
  you?: Player;
  isDrawer: boolean;
  canStart: boolean;
  kanjiCount: number;
}

export interface StrokePoint { x: number; y: number; }
export interface StrokePayload { from: StrokePoint; to: StrokePoint; color: string; width: number; mode: 'pen' | 'eraser'; }
