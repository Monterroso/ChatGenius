'use client';

import { SessionProvider } from 'next-auth/react';
import { ActivityTrackingProvider } from '@/contexts/ActivityTrackingProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ActivityTrackingProvider>
        {children}
      </ActivityTrackingProvider>
    </SessionProvider>
  );
} 