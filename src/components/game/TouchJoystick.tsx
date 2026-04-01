import { useRef, useCallback, useEffect, useState } from 'react';

interface TouchJoystickProps {
  onMove: (dx: number, dz: number) => void;
}

export default function TouchJoystick({ onMove }: TouchJoystickProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const centerRef = useRef({ x: 0, y: 0 });
  const radius = 50;

  const handleStart = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    centerRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    setActive(true);
    updateKnob(clientX, clientY);
  }, []);

  const updateKnob = useCallback((clientX: number, clientY: number) => {
    const cx = centerRef.current.x;
    const cy = centerRef.current.y;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > radius) {
      dx = (dx / dist) * radius;
      dy = (dy / dist) * radius;
    }
    setKnobPos({ x: dx, y: dy });
    // Normalize to -1..1
    const nx = dx / radius;
    const ny = dy / radius;
    onMove(nx, ny);
  }, [onMove]);

  const handleEnd = useCallback(() => {
    setActive(false);
    setKnobPos({ x: 0, y: 0 });
    onMove(0, 0);
  }, [onMove]);

  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (!active) return;
      e.preventDefault();
      const touch = e.touches[0];
      updateKnob(touch.clientX, touch.clientY);
    };
    const onTouchEnd = () => handleEnd();
    const onMouseMove = (e: MouseEvent) => {
      if (!active) return;
      updateKnob(e.clientX, e.clientY);
    };
    const onMouseUp = () => handleEnd();

    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [active, updateKnob, handleEnd]);

  return (
    <div
      ref={containerRef}
      className="absolute bottom-8 left-8 w-[120px] h-[120px] rounded-full pointer-events-auto z-20"
      style={{
        background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)',
        border: '2px solid rgba(255,255,255,0.2)',
        touchAction: 'none',
      }}
      onTouchStart={(e) => {
        e.preventDefault();
        const touch = e.touches[0];
        handleStart(touch.clientX, touch.clientY);
      }}
      onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
    >
      {/* Knob */}
      <div
        className="absolute w-12 h-12 rounded-full"
        style={{
          background: active
            ? 'radial-gradient(circle, rgba(255,215,0,0.7), rgba(255,215,0,0.3))'
            : 'radial-gradient(circle, rgba(255,255,255,0.4), rgba(255,255,255,0.15))',
          border: '2px solid rgba(255,255,255,0.3)',
          left: '50%',
          top: '50%',
          transform: `translate(calc(-50% + ${knobPos.x}px), calc(-50% + ${knobPos.y}px))`,
          transition: active ? 'none' : 'transform 0.2s ease-out',
        }}
      />
    </div>
  );
}
