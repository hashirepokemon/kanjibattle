import { useEffect, useMemo, useState } from 'react';
import type { GameSettings, GradeKey, RoomView } from '@shared/types';
import DrawingCanvas from './DrawingCanvas';
import { socket } from './socket';

type AnswerFeedback = { correct: boolean; nonce: number } | null;
type MascotPopup = { id: number; src: string; left: number; top: number; size: number; flip: boolean; delay: number; rotate: number; ring: string };

const grades: Array<{ value: GradeKey; label: string }> = [
  { value: 'grade1', label: 'Grade 1' },
  { value: 'grade2', label: 'Grade 2' },
  { value: 'grade3', label: 'Grade 3' },
  { value: 'grade4', label: 'Grade 4' },
  { value: 'grade5', label: 'Grade 5' },
  { value: 'grade6', label: 'Grade 6' },
  { value: 'juniorHigh', label: 'Junior High and above' },
  { value: 'advanced', label: 'AP Japanese / Advanced Learners' },
  { value: 'jlptN5', label: 'JLPT N5' },
  { value: 'jlptN4', label: 'JLPT N4' },
  { value: 'jlptN3', label: 'JLPT N3' },
  { value: 'jlptN2', label: 'JLPT N2' },
  { value: 'jlptN1', label: 'JLPT N1' }
];

const mascotImages = [
  '/mascots/mascot-chibi-black.png',
  '/mascots/mascot-chibi-brown.png',
  '/mascots/mascot-chibi-blue.png',
  '/mascots/mascot-chibi-white.png',
  '/mascots/mascot-chibi-cream.png',
  '/mascots/mascot-portrait-blonde.png',
  '/mascots/mascot-chibi-puff.png',
  '/mascots/mascot-chibi-coat.png',
  '/mascots/mascot-chibi-stand.png',
  '/mascots/mascot-chibi-whitecoat.png',
  '/mascots/mascot-chibi-formal.png',
  '/mascots/mascot-chibi-orange.png',
  '/mascots/mascot-chibi-pink.png'
];

const mascotZones = [
  { left: [7, 17], top: [18, 70] },
  { left: [83, 93], top: [18, 70] },
  { left: [16, 30], top: [78, 88] },
  { left: [70, 84], top: [78, 88] }
];

function randomMascot(id: number): MascotPopup {
  const zone = mascotZones[Math.floor(Math.random() * mascotZones.length)];
  const ringColors = ['#ffffff', '#facc15', '#38bdf8', '#fb7185', '#a7f3d0', '#c4b5fd'];
  return {
    id,
    src: mascotImages[Math.floor(Math.random() * mascotImages.length)],
    left: zone.left[0] + Math.random() * (zone.left[1] - zone.left[0]),
    top: zone.top[0] + Math.random() * (zone.top[1] - zone.top[0]),
    size: 68 + Math.random() * 46,
    flip: Math.random() > 0.5,
    delay: Math.random() * 0.35,
    rotate: -10 + Math.random() * 20,
    ring: ringColors[Math.floor(Math.random() * ringColors.length)]
  };
}

function MascotPopups() {
  const [popups, setPopups] = useState<MascotPopup[]>([]);

  useEffect(() => {
    let nextId = 1;
    const showMascot = () => {
      const id = nextId;
      nextId += 1;
      setPopups((current) => [...current.slice(-1), randomMascot(id)]);
      window.setTimeout(() => {
        setPopups((current) => current.filter((popup) => popup.id !== id));
      }, 6200);
    };

    const firstTimer = window.setTimeout(showMascot, 4200);
    const interval = window.setInterval(showMascot, 20000);
    return () => {
      window.clearTimeout(firstTimer);
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="mascot-layer" aria-hidden="true">
      {popups.map((popup) => (
        <img
          key={popup.id}
          className="mascot-popup"
          src={popup.src}
          alt=""
          style={{
            left: `${popup.left}%`,
            top: `${popup.top}%`,
            width: `${popup.size}px`,
            animationDelay: `${popup.delay}s`,
            ['--mascot-flip' as string]: popup.flip ? -1 : 1,
            ['--mascot-rotate' as string]: `${popup.rotate}deg`,
            ['--mascot-ring' as string]: popup.ring
          }}
        />
      ))}
    </div>
  );
}

function RulesPage({ onBack }: { onBack: () => void }) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-yuzu/45 via-white to-sora/40 p-4 text-sumi">
      <MascotPopups />
      <section className="mx-auto max-w-5xl py-6">
        <button className="tool-button mb-5" onClick={onBack}>Back</button>
        <div className="panel">
          <p className="text-lg font-black text-sakura">How to play</p>
          <h1 className="mt-2 text-4xl font-black md:text-6xl">Kanji Draw Battle Rules</h1>
          <p className="mt-4 text-lg font-bold leading-8 text-slate-600">Kanji Draw Battle is a real-time classroom game. One player sees a Japanese reading and writes the matching kanji, while everyone else chooses the correct reading.</p>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="panel">
            <h2 className="text-2xl font-black">1. Room Setup</h2>
            <p className="mt-3 font-bold leading-7 text-slate-600">The host creates a room and shares the room code, direct link, or QR code. Up to 8 players can join. When the room is full, the game starts automatically.</p>
          </div>
          <div className="panel">
            <h2 className="text-2xl font-black">2. Game Modes</h2>
            <p className="mt-3 font-bold leading-7 text-slate-600">The host can choose grade-level kanji, JLPT N5-N1 kanji, a custom teacher list, or a short review mode for today&apos;s lesson.</p>
          </div>
          <div className="panel">
            <h2 className="text-2xl font-black">3. Drawer Turn</h2>
            <p className="mt-3 font-bold leading-7 text-slate-600">The drawer sees a Japanese reading and writes the matching kanji on the canvas. Okurigana appears in parentheses, and the exact kanji hint appears after 10 seconds.</p>
          </div>
          <div className="panel">
            <h2 className="text-2xl font-black">4. Guessing</h2>
            <p className="mt-3 font-bold leading-7 text-slate-600">Guessers cannot see the drawer&apos;s prompt. They watch the drawing and choose the correct reading. A wrong answer locks that player out for the rest of the turn.</p>
          </div>
          <div className="panel">
            <h2 className="text-2xl font-black">5. Scoring</h2>
            <p className="mt-3 font-bold leading-7 text-slate-600">Only the first correct guesser gets 1 point. The drawer also gets 1 point when someone guesses correctly. Later correct answers in the same turn do not score.</p>
          </div>
          <div className="panel">
            <h2 className="text-2xl font-black">6. Next Turn</h2>
            <p className="mt-3 font-bold leading-7 text-slate-600">The host can use winner-next mode or order mode. If every guesser answers incorrectly, the turn ends immediately. In a 2-player game, the same drawer may continue when the only guesser misses.</p>
          </div>
          <div className="panel">
            <h2 className="text-2xl font-black">7. Rescue Rule</h2>
            <p className="mt-3 font-bold leading-7 text-slate-600">Players with low scores get fewer choices. A 0-point player gets 3 choices, and a player who has missed several rounds may get 2 choices. The correct answer is always included.</p>
          </div>
          <div className="panel">
            <h2 className="text-2xl font-black">8. Results</h2>
            <p className="mt-3 font-bold leading-7 text-slate-600">After the round limit is reached, the app shows rankings, scores, and correct counts. The host can return everyone to the lobby and play again.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

function playFeedbackSound(correct: boolean) {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const now = context.currentTime;
    const play = (frequency: number, start: number, duration: number, type: OscillatorType = 'sine', volume = 0.1) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now + start);
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(volume, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now + start);
      oscillator.stop(now + start + duration + 0.03);
    };

    if (correct) {
      play(523.25, 0, 0.16, 'sawtooth', 0.09);
      play(659.25, 0.08, 0.17, 'sawtooth', 0.09);
      play(783.99, 0.16, 0.2, 'sawtooth', 0.1);
      play(1046.5, 0.32, 0.34, 'triangle', 0.12);
      play(1318.51, 0.36, 0.28, 'triangle', 0.08);
    } else {
      play(130, 0, 0.34, 'square', 0.1);
      play(92, 0.2, 0.36, 'square', 0.09);
      play(65, 0.36, 0.28, 'sawtooth', 0.07);
    }
    window.setTimeout(() => void context.close(), 950);
  } catch {
    // Some browsers block Web Audio until the player interacts. The visual feedback still works.
  }
}

async function writeClipboardText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall back to the textarea method below.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

export default function App() {
  const [name, setName] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [view, setView] = useState<RoomView | null>(null);
  const [error, setError] = useState('');
  const [answerFeedback, setAnswerFeedback] = useState<AnswerFeedback>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const [joinNameStep, setJoinNameStep] = useState(false);
  const [showRules, setShowRules] = useState(() => window.location.hash === '#rules');
  const [inviteRoomCode, setInviteRoomCode] = useState('');

  useEffect(() => {
    const invitedRoom = new URLSearchParams(window.location.search).get('room');
    if (invitedRoom) {
      const normalizedRoom = invitedRoom.toUpperCase();
      setInviteRoomCode(normalizedRoom);
      setRoomCodeInput(normalizedRoom);
      setJoinNameStep(true);
    }

    const onAnswerResult = (payload: { correct: boolean }) => {
      setAnswerFeedback({ correct: payload.correct, nonce: Date.now() });
      playFeedbackSound(payload.correct);
      window.setTimeout(() => setAnswerFeedback(null), payload.correct ? 1100 : 750);
    };

    socket.on('game:state', setView);
    socket.on('app:error', setError);
    socket.on('answer:result', onAnswerResult);
    return () => {
      socket.off('game:state', setView);
      socket.off('app:error', setError);
      socket.off('answer:result', onAnswerResult);
    };
  }, []);

  const sortedPlayers = useMemo(() => [...(view?.players ?? [])].sort((a, b) => b.score - a.score), [view?.players]);
  const updateSettings = (patch: Partial<GameSettings>) => socket.emit('settings:update', patch);
  const inviteLink = view ? `${window.location.origin}${window.location.pathname}?room=${view.roomCode}` : '';
  const qrCodeUrl = inviteLink ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(inviteLink)}` : '';
  const shareText = view ? `Join my Kanji Draw Battle room: ${view.roomCode}` : '';
  const twitterShareUrl = inviteLink ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(inviteLink)}` : '';
  const copyInviteLink = async () => {
    if (!inviteLink) return;
    const copied = await writeClipboardText(inviteLink);
    if (copied) {
      setCopyStatus('Link copied!');
      window.setTimeout(() => setCopyStatus(''), 2200);
    } else {
      setCopyStatus(inviteLink);
    }
  };
  const shareInviteLink = async () => {
    if (!inviteLink) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Kanji Draw Battle', text: shareText, url: inviteLink });
        return;
      }
      await copyInviteLink();
    } catch {
      await copyInviteLink();
    }
  };
  const prepareJoin = () => {
    if (!roomCodeInput.trim()) {
      setError('Please enter a room code.');
      return;
    }
    setError('');
    setJoinNameStep(true);
  };
  const submitJoin = () => socket.emit('room:join', { name, roomCode: roomCodeInput.trim().toUpperCase() });
  const openRules = () => {
    setShowRules(true);
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#rules`);
  };
  const closeRules = () => {
    setShowRules(false);
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  };

  if (!view) {
    if (showRules) return <RulesPage onBack={closeRules} />;

    return (
      <main className="min-h-screen bg-gradient-to-br from-yuzu/50 via-white to-sora/40 p-4 text-sumi">
        <MascotPopups />
        <section className="mx-auto flex min-h-screen max-w-5xl items-center justify-center">
          <div className="grid w-full gap-6 rounded-[2rem] bg-white/90 p-6 shadow-soft md:grid-cols-[1.1fr_0.9fr] md:p-10">
            <div className="flex flex-col justify-center">
              <p className="text-lg font-black text-sakura">Real-time kanji learning battle</p>
              <h1 className="mt-3 text-5xl font-black leading-tight md:text-7xl">Kanji Draw Battle</h1>
              <p className="mt-5 text-lg font-bold leading-8 text-slate-600">One player sees a Japanese reading, writes the matching kanji, and everyone else chooses the correct reading. <button className="read-more-link" onClick={openRules}>Read more...</button></p>
            </div>
            <div className="rounded-[1.5rem] bg-sora/20 p-5">
              {!joinNameStep && !inviteRoomCode ? <>
                <label className="label">Name for hosting</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Example: Aoi" />
                <button className="primary-button mt-4 w-full" onClick={() => socket.emit('room:create', { name })}>Create Room</button>
                <div className="my-5 h-px bg-slate-200" />
                <label className="label">Room Code</label>
                <input className="input uppercase" value={roomCodeInput} onChange={(e) => { setRoomCodeInput(e.target.value.toUpperCase()); setJoinNameStep(false); }} placeholder="ABCDE" />
                <button className="secondary-button mt-4 w-full" onClick={prepareJoin}>Join Room</button>
              </> : <>
                <p className="text-center text-lg font-black text-sakura">Join Room</p>
                <p className="rounded-2xl bg-white p-3 text-center text-xl font-black tracking-[0.12em] text-sumi">{roomCodeInput}</p>
                <label className="label mt-5">Your Name</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Example: Aoi" autoFocus />
                <button className="primary-button mt-4 w-full" onClick={submitJoin}>Enter Room</button>
                {!inviteRoomCode && <button className="tool-button mt-3 w-full" onClick={() => setJoinNameStep(false)}>Change Room Code</button>}
              </>}
              {error && <p className="mt-4 rounded-xl bg-red-100 p-3 font-bold text-red-700">{error}</p>}
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (view.phase === 'results') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-yuzu/40 via-white to-sakura/20 p-4 text-sumi">
        <MascotPopups />
        <section className="mx-auto max-w-4xl py-10">
          <h1 className="text-center text-5xl font-black">Final Results</h1>
          <div className="mt-8 grid gap-3">
            {sortedPlayers.map((p, index) => (
              <div key={p.id} className="flex items-center justify-between rounded-3xl bg-white p-5 shadow-soft">
                <div className="text-2xl font-black">#{index + 1} {p.name}</div>
                <div className="text-xl font-black text-sakura">{p.score} pts / {p.correctCount} correct</div>
              </div>
            ))}
          </div>
          {view.you?.isHost && <button className="primary-button mx-auto mt-8 block" onClick={() => socket.emit('game:restart')}>Back to Lobby</button>}
        </section>
      </main>
    );
  }

  if (view.phase === 'lobby') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-sora/30 via-white to-yuzu/40 p-4 text-sumi">
        <MascotPopups />
        <section className="mx-auto grid max-w-6xl gap-5 py-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="panel">
            <h1 className="text-4xl font-black">Lobby</h1>
            <p className="mt-3 text-lg font-bold text-slate-600">Room Code</p>
            <div className="mt-2 rounded-3xl bg-sumi p-5 text-center text-5xl font-black tracking-[0.2em] text-white">{view.roomCode}</div>
            <div className="mt-4 grid gap-4 rounded-3xl bg-sora/15 p-4 md:grid-cols-[180px_1fr]">
              <img className="mx-auto rounded-2xl bg-white p-2 shadow-soft" src={qrCodeUrl} alt={`QR code for room ${view.roomCode}`} width="180" height="180" />
              <div className="flex min-w-0 flex-col justify-center gap-3">
                <p className="text-lg font-black">Invite Link</p>
                <p className="break-all rounded-2xl bg-white p-3 text-sm font-bold text-slate-600">{inviteLink}</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <button className="secondary-button text-base" onClick={copyInviteLink}>Copy Link</button>
                  <button className="primary-button text-base" onClick={shareInviteLink}>Share</button>
                  <a className="secondary-button text-center text-base" href={twitterShareUrl} target="_blank" rel="noreferrer">X / Twitter</a>
                </div>
                {copyStatus && <p className="rounded-xl bg-matcha/10 p-2 text-sm font-black text-matcha">{copyStatus}</p>}
              </div>
            </div>
            <h2 className="mt-6 text-2xl font-black">Players</h2>
            <p className="mt-1 text-sm font-black text-slate-500">{view.players.length} / 8 players</p>
            <p className="mt-1 text-sm font-black text-slate-500">The game starts automatically when the room reaches 8 players.</p>
            <div className="mt-3 grid gap-2">{view.players.map((p) => <div key={p.id} className="rounded-2xl bg-yuzu/30 px-4 py-3 font-black">{p.name}{p.isHost ? ' (Host)' : ''}</div>)}</div>
          </div>

          {view.you?.isHost ? <div className="panel">
            <h2 className="text-3xl font-black">Game Settings</h2>
            <fieldset disabled={!view.you?.isHost} className="mt-5 grid gap-4">
              <label className="label">Question Mode</label>
              <select className="input" value={view.settings.mode} onChange={(e) => updateSettings({ mode: e.target.value as GameSettings['mode'] })}>
                <option value="grade">Grade Kanji Mode</option>
                <option value="custom">Teacher Custom Kanji Mode</option>
                <option value="review">Today Review Mode</option>
              </select>
              {view.settings.mode === 'grade' && <><label className="label">Learning Level</label><div className="level-select-wrap"><span aria-hidden="true">🎓</span><select className="input level-select" value={view.settings.grade} onChange={(e) => updateSettings({ grade: e.target.value as GradeKey })}>{grades.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select></div><p className="-mt-2 text-sm font-bold text-slate-500">Grade levels follow the current MEXT grade allocation. JLPT and AP use their dedicated lists.</p></>}
              {view.settings.mode !== 'grade' && <><label className="label">Kanji for this game</label><textarea className="input min-h-28" value={view.settings.customKanjiInput} onChange={(e) => updateSettings({ customKanjiInput: e.target.value })} placeholder={'\u68ee, \u6797, \u5ddd, \u5c71, \u706b, \u6c34'} /></>}
              <div className="grid gap-4 md:grid-cols-2">
                <div><label className="label">Next Drawer</label><select className="input" value={view.settings.nextDrawerRule} onChange={(e) => updateSettings({ nextDrawerRule: e.target.value as GameSettings['nextDrawerRule'] })}><option value="winner">Winner draws next</option><option value="order">Take turns in order</option></select></div>
                <div><label className="label">Rounds</label><input className="input" type="number" min="1" max="20" value={view.settings.roundLimit} onChange={(e) => updateSettings({ roundLimit: Number(e.target.value) })} /></div>
                <div><label className="label">Time Limit (seconds)</label><input className="input" type="number" min="15" max="180" value={view.settings.turnSeconds} onChange={(e) => updateSettings({ turnSeconds: Number(e.target.value) })} /></div>
              </div>
              <label className="flex items-center gap-3 rounded-2xl bg-matcha/10 p-4 text-lg font-black"><input type="checkbox" checked={view.settings.rescueEnabled} onChange={(e) => updateSettings({ rescueEnabled: e.target.checked })} />Rescue rule ON</label>
            </fieldset>
            <p className="mt-4 font-bold text-slate-600">Available kanji: {view.kanjiCount}</p>
            {view.you?.isHost && <button className="primary-button mt-5 w-full" disabled={!view.canStart} onClick={() => socket.emit('game:start')}>{view.canStart ? 'Start Game' : 'Need 2+ players and kanji'}</button>}
          </div> : <div className="panel flex min-h-[360px] flex-col justify-center text-center">
            <h2 className="text-3xl font-black">Waiting for the host</h2>
            <p className="mt-4 text-lg font-bold leading-8 text-slate-600">You are in the room. The host is choosing the game settings.</p>
            <p className="mt-4 rounded-2xl bg-yuzu/30 p-4 font-black">Players: {view.players.length} / 8</p>
          </div>}
        </section>
      </main>
    );
  }

  const hintCountdown = Math.max(0, (view.settings.turnSeconds - 10) - (view.currentTurn?.secondsLeft ?? 0));
  const answerLocked = Boolean(view.currentTurn?.answerLocked);

  const selectedLevel = view.settings.mode === 'grade'
    ? grades.find((grade) => grade.value === view.settings.grade)?.label ?? 'Learning level'
    : view.settings.mode === 'review'
      ? 'Today Review'
      : 'Teacher Custom';

  return (
    <main className="game-shell min-h-screen p-3 text-sumi">
      <MascotPopups />
      {answerFeedback && (
        <div key={answerFeedback.nonce} className={`feedback-overlay ${answerFeedback.correct ? 'feedback-correct' : 'feedback-wrong'}`} aria-live="polite">
          <div className={answerFeedback.correct ? 'sparkle-burst' : 'wrong-burst'}>{answerFeedback.correct ? '✨' : '×'}</div>
        </div>
      )}
      <section className="mx-auto max-w-[1440px]">
        <header className="game-header">
          <div><p className="text-sm font-black text-sakura">Kanji Draw Battle</p><p className="text-2xl font-black">Round {view.currentTurn?.round} <span className="text-base text-slate-400">of {view.settings.roundLimit}</span></p></div>
          <div className="game-header-level"><span aria-hidden="true">🎓</span><span>{selectedLevel}</span></div>
          <p className="game-header-status">{view.currentTurn?.statusMessage}</p>
        </header>
        <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_310px]">
        <div className="min-w-0">
          {view.isDrawer ? <section className="prompt-card" aria-label="Your drawing prompt">
            <div className="prompt-card-main">
              <p className="prompt-label"><span aria-hidden="true">✏️</span> Write the kanji for</p>
              <p className="prompt-value">{view.currentTurn?.prompt}</p>
              <p className="prompt-instruction">送り仮名は（ ）で表示</p>
              {view.currentTurn?.answer
                ? <p className="prompt-hint">Hint: write <span>{view.currentTurn.answer}</span></p>
                : <p className="prompt-hint-soon">Hint in {hintCountdown > 0 ? `${hintCountdown}s` : 'a moment'}</p>}
            </div>
            <div className="prompt-timer" aria-label={`${view.currentTurn?.secondsLeft} seconds left`}><span aria-hidden="true">⏱</span><strong>{view.currentTurn?.secondsLeft}</strong><small>sec</small></div>
          </section> : <section className="guesser-banner">
            <div><p className="text-xl font-black">Watch the drawing!</p><p className="font-bold text-slate-600">Scroll down and choose the correct reading.</p></div>
            <div className="guesser-timer"><strong>{view.currentTurn?.secondsLeft}</strong><span>sec</span></div>
          </section>}
          <DrawingCanvas canDraw={view.isDrawer} phase={view.phase} />
          {!view.isDrawer && view.currentTurn?.choices && <section className="answer-zone" aria-label="Multiple choice answers"><div className="answer-zone-heading"><span aria-hidden="true">↓</span><div><p>Choose the reading</p><span>絵の上から指を動かしてもスクロールできます</span></div></div><div className="answer-grid">{view.currentTurn.choices.map((choice, index) => <button key={choice} className="choice-button" disabled={answerLocked || view.phase !== 'playing'} onClick={() => socket.emit('answer:submit', { choice })}><span className="choice-prefix">{String.fromCharCode(65 + index)}.</span><span className="choice-text">{choice}</span></button>)}</div></section>}
          {!view.isDrawer && answerLocked && view.phase === 'playing' && <div className="mt-4 rounded-3xl bg-red-50 p-5 text-center text-xl font-black text-red-600 shadow-soft">You missed this one. Wait until another player answers correctly.</div>}
          {view.currentTurn?.answer && !view.isDrawer && view.phase === 'turn-reveal' && <div className="mt-4 rounded-3xl bg-white p-5 text-center text-3xl font-black shadow-soft">Answer: {view.currentTurn.answer}<span className="block text-xl text-slate-600">Reading: {view.currentTurn.correctChoice}</span></div>}
        </div>
        <aside className="score-panel h-fit">
          <div className="flex items-center justify-between"><h2 className="text-2xl font-black">Players</h2><span className="text-sm font-black text-sora">{view.players.length} playing</span></div>
          <div className="mt-4 grid gap-3">{view.players.map((p, index) => <div key={p.id} className={`player-row ${p.id === view.currentTurn?.drawerId ? 'player-drawing' : ''}`}><img src={mascotImages[index % mascotImages.length]} alt="" /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2 font-black"><span className="truncate">{p.name}{p.id === view.you?.id ? ' (You)' : ''}</span><span className="shrink-0 text-sakura">{p.score} pts</span></div><p className="mt-1 text-xs font-bold text-slate-500">{p.id === view.currentTurn?.drawerId ? 'Drawing now' : `${p.correctCount} correct · ${p.wrongCount} missed`}</p></div></div>)}</div>
        </aside>
        </div>
      </section>
    </main>
  );
}
