import { useRef, useCallback } from 'react';

export function useTouchInput() {
  const touchDir = useRef({ dx: 0, dz: 0 });

  const onJoystickMove = useCallback((dx: number, dz: number) => {
    touchDir.current.dx = dx;
    touchDir.current.dz = dz;
  }, []);

  return { touchDir, onJoystickMove };
}
