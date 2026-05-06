import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

const STORAGE_KEY = 'ihsan_admin_swipe_hint_dismissed';

export function SwipeHintOverlay() {
  const isMobile = useIsMobile();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isMobile) return;
    if (localStorage.getItem(STORAGE_KEY) === '1') return;
    const t = setTimeout(() => setShow(true), 400);
    return () => clearTimeout(t);
  }, [isMobile]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setShow(false);
  };

  if (!isMobile) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-6"
          onClick={dismiss}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl"
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8"
              onClick={dismiss}
            >
              <X className="h-4 w-4" />
            </Button>

            <h3 className="text-lg font-semibold mb-1">Swipe to update orders</h3>
            <p className="text-sm text-muted-foreground mb-5">
              Quickly change an order's status without opening it.
            </p>

            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                <motion.div
                  animate={{ x: [0, 14, 0] }}
                  transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
                  className="flex items-center gap-2 text-primary"
                >
                  <ArrowRight className="h-5 w-5" />
                </motion.div>
                <span className="text-sm">
                  <strong>Swipe right</strong> to advance status
                </span>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                <motion.div
                  animate={{ x: [0, -14, 0] }}
                  transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
                  className="flex items-center gap-2 text-destructive"
                >
                  <ArrowLeft className="h-5 w-5" />
                </motion.div>
                <span className="text-sm">
                  <strong>Swipe left</strong> to revert status
                </span>
              </div>
            </div>

            <Button className="w-full mt-5" onClick={dismiss}>
              Got it
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
