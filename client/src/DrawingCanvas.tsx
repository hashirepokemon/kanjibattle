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
  const [width, setWidth] = useState(10);
  const [mode, setMode] = useState<'pen' | 'eraser'>('pen');

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
    const onStroke = (payload: StrokePayload) => canvasRef.current && drawLine(canvasRef.current, payload);
    const onClear = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };
    socket.on('draw:stroke', onStroke);
    socket.on('canvas:clear', onClear);
    return () => {
      socket.off('draw:stroke', onStroke);
      socket.off('canvas:clear', onClear);
    };
  }, []);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): StrokePoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw || phase !== 'playing') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    lastPointRef.current = pointFromEvent(event);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw || phase !== 'playing' || !lastPointRef.current || !canvasRef.current) return;
    const next = pointFromEvent(event);
    const payload: StrokePayload = { from: lastPointRef.current, to: next, color: '#171717', width, mode };
    drawLine(canvasRef.current, payload);
    socket.emit('draw:stroke', payload);
    lastPointRef.current = next;
  };

  const end = () => { lastPointRef.current = null; };
  const clear = () => socket.emit('canvas:clear');

  return (
    <div className={`drawing-board ${canDraw ? 'drawing-board-editor' : 'drawing-board-viewer'}`}>
      {canDraw && <div className="drawing-toolbar">
        <button className={'tool-button ' + (mode === 'pen' ? 'tool-active' : '')} onClick={() => setMode('pen')} disabled={!canDraw}><span aria-hidden="true">✏️</span> Pen</button>
        <button className={'tool-button ' + (mode === 'eraser' ? 'tool-active' : '')} onClick={() => setMode('eraser')} disabled={!canDraw}><span aria-hidden="true">◩</span> Eraser</button>
        <label className="flex items-center gap-2 text-sm font-bold text-slate-600">Size
          <input type="range" min="4" max="28" value={width} onChange={(e) => setWidth(Number(e.target.value))} disabled={!canDraw} />
        </label>
        <button className="tool-button bg-rose-100 text-rose-700" onClick={clear} disabled={!canDraw}>Clear</button>
      </div>}
      <canvas
        ref={canvasRef}
        className={`drawing-canvas w-full bg-white ${canDraw ? 'touch-none' : 'touch-pan-y'}`}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      />
    </div>
  );
}
