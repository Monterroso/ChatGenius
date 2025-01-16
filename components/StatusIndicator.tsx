import { STATUS_COLORS } from '@/lib/constants';
import type { EffectiveStatus } from '@/types/db';

interface StatusIndicatorProps {
  /**
   * The color class to apply to the status indicator
   */
  colorClass: string;
  /**
   * The status text to show in the tooltip
   */
  statusText: string;
}

/**
 * StatusIndicator component displays a colored dot indicating a user's status.
 * 
 * This is a purely presentational component that renders a colored circle.
 * The parent component is responsible for determining the color and status text.
 * 
 * @component
 * @example
 * ```tsx
 * <StatusIndicator 
 *   colorClass="bg-green-500"
 *   statusText="Online"
 * />
 * ```
 */
export const StatusIndicator = ({ colorClass, statusText }: StatusIndicatorProps) => {
  return (
    <div 
      className={`w-3 h-3 rounded-full ${colorClass} mr-2`}
      title={statusText}
    />
  );
}; 