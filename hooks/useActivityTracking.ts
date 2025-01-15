import { useEffect, useCallback, useRef } from 'react';
import { debounce } from 'lodash';
import { STATUS_THRESHOLDS } from '@/lib/constants';

/**
 * Hook to track user activity and update their status
 * @param debounceMs Time in milliseconds to debounce status updates (default: 10000ms)
 * @param maxUpdateInterval Maximum time between updates even during constant activity (default: 60000ms)
 */
export function useActivityTracking(
  debounceMs = 10000, 
  maxUpdateInterval = 10000
) {
  const isEnabled = useRef(false);
  const lastUpdateTime = useRef(0);
  const lastActivityTime = useRef(Date.now());

  // Function to determine current status based on activity
  const getCurrentStatus = useCallback(() => {
    const now = Date.now();
    return now - lastActivityTime.current >= STATUS_THRESHOLDS.AWAY ? 'away' : 'online';
  }, []);

  // Debounced function to update status
  const updateStatus = useCallback(
    debounce(async () => {
      if (!isEnabled.current) return;

      const now = Date.now();
      // Only update if we haven't updated in the last maxUpdateInterval
      if (now - lastUpdateTime.current >= maxUpdateInterval) {
        try {
          const response = await fetch('/api/status', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              manual_status: null // Clear any manual status
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            console.error('Failed to update status:', error);
          } else {
            lastUpdateTime.current = now;
          }
        } catch (error) {
          console.error('Failed to update status:', error);
        }
      }
    }, debounceMs),
    [debounceMs, maxUpdateInterval]
  );

  // Force an update every maxUpdateInterval
  useEffect(() => {
    if (!isEnabled.current) return;

    const intervalId = setInterval(() => {
      const now = Date.now();
      if (now - lastUpdateTime.current >= maxUpdateInterval) {
        updateStatus();
      }
    }, maxUpdateInterval);

    return () => clearInterval(intervalId);
  }, [maxUpdateInterval, updateStatus]);

  // Check for away status periodically
  useEffect(() => {
    if (!isEnabled.current) return;

    const checkAwayStatus = () => {
      const currentStatus = getCurrentStatus();
      // If status changed to away, update immediately
      if (currentStatus === 'away' && Date.now() - lastUpdateTime.current >= debounceMs) {
        updateStatus();
      }
    };

    const awayCheckInterval = setInterval(checkAwayStatus, STATUS_THRESHOLDS.AWAY / 2);
    return () => clearInterval(awayCheckInterval);
  }, [getCurrentStatus, updateStatus, debounceMs]);

  const handleActivity = useCallback(() => {
    if (isEnabled.current) {
      const wasAway = Date.now() - lastActivityTime.current >= STATUS_THRESHOLDS.AWAY;
      lastActivityTime.current = Date.now();
      
      // If we were away, update immediately without debounce
      if (wasAway) {
        fetch('/api/status', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            manual_status: null,
            auto_status: 'online'  // Explicitly set to online when returning
          }),
        }).catch(error => {
          console.error('Failed to update status:', error);
        });
        lastUpdateTime.current = Date.now();

        // Dispatch a custom event to trigger immediate polling
        const returnEvent = new CustomEvent('user-returned');
        document.dispatchEvent(returnEvent);
      }
      
      // Still call debounced update for regular activity tracking
      updateStatus();
    }
  }, [updateStatus]);

  useEffect(() => {
    // List of events to track
    const events = [
      'mousedown',
      'keydown',
      'mousemove',
      'wheel',
      'touchstart',
      'scroll'
    ];

    // Add event listeners when enabled
    const addListeners = () => {
      events.forEach(event => {
        document.addEventListener(event, handleActivity, { passive: true });
      });
    };

    // Remove event listeners
    const removeListeners = () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };

    // Add listeners if enabled
    if (isEnabled.current) {
      addListeners();
    }

    // Cleanup on unmount
    return () => {
      updateStatus.cancel();
      removeListeners();
    };
  }, [handleActivity, updateStatus]);

  return {
    enable: () => {
      isEnabled.current = true;
      lastUpdateTime.current = 0; // Reset last update time
      lastActivityTime.current = Date.now(); // Reset last activity time
      // List of events to track
      const events = [
        'mousedown',
        'keydown',
        'mousemove',
        'wheel',
        'touchstart',
        'scroll'
      ];
      events.forEach(event => {
        document.addEventListener(event, handleActivity, { passive: true });
      });
      // Immediately update status when enabled
      updateStatus();
    },
    disable: () => {
      isEnabled.current = false;
      // List of events to track
      const events = [
        'mousedown',
        'keydown',
        'mousemove',
        'wheel',
        'touchstart',
        'scroll'
      ];
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      updateStatus.cancel();
    }
  };
} 