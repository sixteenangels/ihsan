import { Copy, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface GroupBuyShareSheetProps {
  groupBuyId: string;
  title: string;
  discount: number | null;
}

export function GroupBuyShareSheet({ groupBuyId, title, discount }: GroupBuyShareSheetProps) {
  const shareUrl = `${window.location.origin}/group-buy/${groupBuyId}`;
  const shareText = `Join my group buy "${title}" and save ${discount || 0}%! ${shareUrl}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success('Link copied!');
  };

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleCopy}>
        <Copy className="h-4 w-4 mr-1" />
        Copy Link
      </Button>
      <Button variant="outline" size="sm" onClick={handleWhatsApp} className="text-green-600">
        <Share2 className="h-4 w-4 mr-1" />
        WhatsApp
      </Button>
    </div>
  );
}
