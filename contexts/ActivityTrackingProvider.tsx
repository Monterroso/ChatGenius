'use client';

import { useSession } from 'next-auth/react';
import { useActivityTracking } from '@/hooks/useActivityTracking';
import { useEffect } from 'react';

export function ActivityTrackingProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const track = useActivityTracking();

  // Only enable tracking if user is authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      track.enable();
    } else {
      track.disable();
    }
  }, [status, track]);

  return <>{children}</>;
} 