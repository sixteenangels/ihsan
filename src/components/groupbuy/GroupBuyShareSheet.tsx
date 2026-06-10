import { Copy, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';

interface GroupBuyShareSheetProps {
  groupBuyId: string;
  title: string;
  price: number;
  savingsPercent: number;
  participantsNeeded?: number;
  targetParticipants?: number;
}

export function GroupBuyShareSheet({
  groupBuyId,
  title,
  price,
  savingsPercent,
  participantsNeeded = 0,
  targetParticipants,
}: GroupBuyShareSheetProps) {
  const { user } = useAuth();
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const shareUrl = `${window.location.origin}/group-buy/${groupBuyId}${inviteCode ? `?invite=${inviteCode}` : ''}`;
  const progressText =
    participantsNeeded > 0
      ? `We need ${participantsNeeded} more ${participantsNeeded === 1 ? 'person' : 'people'} to fill the target${targetParticipants ? ` of ${targetParticipants}` : ''}.`
      : 'The target is filled and the group is ready to convert.';
  const shareText = `Join my group buy "${title}" for a fixed price of GHS ${price.toFixed(2)} and save up to ${savingsPercent}%. ${progressText} ${shareUrl}`;

  const getShareUrl = async (channel: string) => {
    if (!user) {
      return `${window.location.origin}/group-buy/${groupBuyId}`;
    }

    if (inviteCode) {
      return `${window.location.origin}/group-buy/${groupBuyId}?invite=${inviteCode}`;
    }

    const nextCode = `GB-${groupBuyId.slice(0, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const { error } = await supabase
      .from('group_buy_invites' as never)
      .insert({
        group_buy_id: groupBuyId,
        inviter_user_id: user.id,
        invite_code: nextCode,
        channel,
      } as never);

    if (error) {
      return `${window.location.origin}/group-buy/${groupBuyId}`;
    }

    setInviteCode(nextCode);
    return `${window.location.origin}/group-buy/${groupBuyId}?invite=${nextCode}`;
  };

  const handleCopy = async () => {
    const nextShareUrl = await getShareUrl('copy');
    navigator.clipboard.writeText(nextShareUrl);
    toast.success('Link copied!');
  };

  const handleWhatsApp = async () => {
    const nextShareUrl = await getShareUrl('whatsapp');
    const nextShareText = shareText.replace(shareUrl, nextShareUrl);
    window.open(`https://wa.me/?text=${encodeURIComponent(nextShareText)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {participantsNeeded > 0
          ? `Share with ${participantsNeeded === 1 ? 'one more friend' : `${participantsNeeded} more friends`} to help the group reach the locked price faster.`
          : 'The target is filled. Share it anyway if you want others to watch for the next round.'}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          <Copy className="h-4 w-4 mr-1" />
          Copy Link
        </Button>
        <Button variant="outline" size="sm" onClick={handleWhatsApp} className="text-green-600">
          <Share2 className="h-4 w-4 mr-1" />
          WhatsApp
        </Button>
      </div>
    </div>
  );
}
