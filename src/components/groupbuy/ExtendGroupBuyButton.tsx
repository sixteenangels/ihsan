import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ExtendGroupBuyButtonProps {
  canExtend: boolean;
  className?: string;
  extensionUsed: boolean;
  groupBuyId: string;
  isHost: boolean;
}

const EXTENSION_OPTIONS = [2, 4, 6] as const;

export function ExtendGroupBuyButton({
  canExtend,
  className,
  extensionUsed,
  groupBuyId,
  isHost,
}: ExtendGroupBuyButtonProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const extendMutation = useMutation({
    mutationFn: async (hours: (typeof EXTENSION_OPTIONS)[number]) => {
      if (!user) {
        throw new Error('Please sign in to extend this group buy');
      }

      const { data, error } = await supabase
        .from('group_buys')
        .update({ extension_hours: hours })
        .eq('id', groupBuyId)
        .eq('created_by', user.id)
        .select('id, expires_at, extension_hours, extension_used')
        .single();

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['group-buys'] });
      queryClient.invalidateQueries({ queryKey: ['my-group-buys'] });
      queryClient.invalidateQueries({ queryKey: ['group-buy-detail', groupBuyId] });
      queryClient.invalidateQueries({ queryKey: ['product-active-group-buys'] });
      setIsOpen(false);
      toast.success(
        `Group buy extended by ${data.extension_hours} hour${data.extension_hours === 1 ? '' : 's'}.`,
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not extend the group buy');
    },
  });

  if (!isHost) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('rounded-xl', className)}
          disabled={!canExtend || extensionUsed}
        >
          {extensionUsed ? 'Extension Used' : 'Extend'}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Extend Group Buy</DialogTitle>
          <DialogDescription>
            Choose one final extension window. You can only do this once.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 py-2">
          {EXTENSION_OPTIONS.map((hours) => (
            <Button
              key={hours}
              className="rounded-xl"
              disabled={extendMutation.isPending}
              onClick={() => extendMutation.mutate(hours)}
            >
              {extendMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                `${hours}h`
              )}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
