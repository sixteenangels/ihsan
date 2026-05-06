import { ReactNode, useState } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface SwipeableOrderCardProps {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  disabled?: boolean;
  /** Label shown when swiping right (e.g. next status name) */
  rightLabel?: string;
  /** Label shown when swiping left (e.g. previous status name) */
  leftLabel?: string;
}

/**
 * Mobile-only swipe wrapper for admin order cards.
 * - Swipe right → advance status (calls onSwipeRight)
 * - Swipe left → revert status (calls onSwipeLeft)
 * On desktop, renders children with no gesture layer.
 */
export function SwipeableOrderCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  disabled,
  rightLabel = 'Advance',
  leftLabel = 'Revert',
}: SwipeableOrderCardProps) {
  const isMobile = useIsMobile();
  const x = useMotionValue(0);
  const [committed, setCommitted] = useState<'left' | 'right' | null>(null);

  // Background opacity follows drag distance
  const rightBgOpacity = useTransform(x, [0, 80, 160], [0, 0.6, 1]);
  const leftBgOpacity = useTransform(x, [-160, -80, 0], [1, 0.6, 0]);

  if (!isMobile || disabled) {
    return <>{children}</>;
  }

  const SWIPE_THRESHOLD = 120;

  const handleDragEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const vibrate = (pattern: number | number[]) => {
      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(pattern);
        }
      } catch {}
    };
    if (info.offset.x > SWIPE_THRESHOLD && onSwipeRight) {
      setCommitted('right');
      vibrate([15, 40, 25]);
      onSwipeRight();
      setTimeout(() => setCommitted(null), 600);
    } else if (info.offset.x < -SWIPE_THRESHOLD && onSwipeLeft) {
      setCommitted('left');
      vibrate(30);
      onSwipeLeft();
      setTimeout(() => setCommitted(null), 600);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Right swipe background (advance) */}
      <motion.div
        style={{ opacity: rightBgOpacity }}
        className="absolute inset-y-0 left-0 flex items-center justify-start px-6 bg-primary text-primary-foreground rounded-lg pointer-events-none"
      >
        <div className="flex items-center gap-2">
          <ArrowRight className="h-5 w-5" />
          <span className="font-medium text-sm">{rightLabel}</span>
        </div>
      </motion.div>

      {/* Left swipe background (revert) */}
      <motion.div
        style={{ opacity: leftBgOpacity }}
        className="absolute inset-y-0 right-0 flex items-center justify-end px-6 bg-destructive text-destructive-foreground rounded-lg pointer-events-none"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{leftLabel}</span>
          <ArrowLeft className="h-5 w-5" />
        </div>
      </motion.div>

      {/* Draggable card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        style={{ x }}
        animate={committed ? { x: committed === 'right' ? 300 : -300, opacity: 0 } : { x: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onDragEnd={handleDragEnd}
        className="relative bg-background touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  );
}
