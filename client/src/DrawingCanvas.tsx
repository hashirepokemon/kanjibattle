import { useEffect, useRef, useState } from 'react';
import type { StrokePayload, StrokePoint } from '@shared/types';
import { socket } from './socket';

interface Props {
  canDraw: boolean;
  phase: string;
}

function drawLine(canvas: HTMLCanvasElement, payload: StrokePayload) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = payload.width;
  ctx.strokeStyle = payload.mode === 'eraser' ? '#ffffff' : payload.color;
  ctx.globalCompositeOperation = payload.mode === 'eraser' ? 'destination-out' : 'source-over';
  ctx.beginPath();
  ctx.moveTo(payload.from.x * canvas.width, payload.from.y * canvas.height);
  ctx.lineTo(payload.to.x * canvas.width, payload.to.y * canvas.height);
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
}

export default function DrawingCanvas({ canDraw, phase }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastPointRef = useRef<StrokePoint | null>(null);
  const historyRef = useRef<string[]>([]);
  const [width, setWidth] = useState(10);
  const [mode, setMode] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState('#171717');
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const image = canvas.toDataURL();
      canvas.width = canvas.clientWidth * window.devicePixelRatio;
      canvas.height = canvas.clientHeight * window.devicePixelRatio;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        img.src = image;
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    const onStroke = (payload: StrokePayload) => {
      if (canvasRef.current) drawLine(canvasRef.current, payload);
      setHasInk(true);
    };
    const onClear = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        historyRef.current = [];
        setHasInk(false);
      }
    };
    const onReplace = (imageData: string) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (!imageData) {
        setHasInk(false);
        return;
      }
      const image = new Image();
      image.onload = () => {
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        setHasInk(true);
      };
      image.src = imageData;
    };
    socket.on('draw:stroke', onStroke);
    socket.on('canvas:clear', onClear);
    socket.on('canvas:replace', onReplace);
    return () => {
      socket.off('draw:stroke', onStroke);
      socket.off('canvas:clear', onClear);
      socket.off('canvas:replace', onReplace);
    };
  }, []);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): StrokePoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw || phase !== 'playing') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    historyRef.current.push(event.currentTarget.toDataURL());
    if (historyRef.current.length > 20) historyRef.current.shift();
    lastPointRef.current = pointFromEvent(event);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw || phase !== 'playing' || !lastPointRef.current || !canvasRef.current) return;
    const next = pointFromEvent(event);
    const payload: StrokePayload = { from: lastPointRef.current, to: next, color, width, mode };
    drawLine(canvasRef.current, payload);
    socket.emit('draw:stroke', payload);
    setHasInk(true);
    lastPointRef.current = next;
  };

  const end = () => { lastPointRef.current = null; };
  const clear = () => socket.emit('canvas:clear');
  const undo = () => {
    const canvas = canvasRef.current;
    const previous = historyRef.current.pop();
    if (!canvas || !previous) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const image = new Image();
    image.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const replacement = canvas.toDataURL();
      socket.emit('canvas:replace', replacement);
      setHasInk(historyRef.current.length > 0);
    };
    image.src = previous;
  };

  return (
    <div className={`drawing-board ${canDraw ? 'drawing-board-editor' : 'drawing-board-viewer'}`}>
      <div className="canvas-wrap">
        <canvas
          ref={canvasRef}
          className={`drawing-canvas w-full bg-white ${canDraw ? 'touch-none' : 'touch-pan-y'}`}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
        {!hasInk && <div className="canvas-empty"><span aria-hidden="true">🐾</span>{canDraw ? 'Draw the kanji here' : 'Opponent is drawing...'}</div>}
      </div>
      {canDraw && <div className="drawing-toolbar">
        <button className={'tool-button ' + (mode === 'pen' ? 'tool-active' : '')} onClick={() => setMode('pen')}><span aria-hidden="true">✏️</span> Pen</button>
        <button className={'tool-button ' + (mode === 'eraser' ? 'tool-active' : '')} onClick={() => setMode('eraser')}><span aria-hidden="true">◩</span> Eraser</button>
        <button className="tool-button" onClick={undo} disabled={historyRef.current.length === 0}><span aria-hidden="true">↶</span> Undo</button>
        <button className="tool-button" onClick={clear}><span aria-hidden="true">▣</span> Clear</button>
        <label className="brush-control">Brush Size<input type="range" min="4" max="28" value={width} onChange={(e) => setWidth(Number(e.target.value))} /></label>
        <div className="color-control" aria-label="Pen color">{['#171717', '#38bdf8', '#fb6f92'].map((swatch) => <button key={swatch} type="button" aria-label={`Use ${swatch} pen`} className={color === swatch ? 'color-swatch color-selected' : 'color-swatch'} style={{ backgroundColor: swatch }} onClick={() => { setColor(swatch); setMode('pen'); }} />)}</div>
      </div>}
    </div>
  );
}
