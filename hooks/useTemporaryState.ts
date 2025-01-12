import { useState, useCallback } from 'react';

export const useTemporaryState = (duration: number = 2000) => {
  const [state, setState] = useState(false);
  
  const setTemporary = useCallback(() => {
    setState(true);
    const timeout = setTimeout(() => setState(false), duration);
    return () => clearTimeout(timeout);
  }, [duration]);
  
  return [state, setTemporary] as const;
}; 