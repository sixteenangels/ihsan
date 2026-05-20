import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { GroupBuyParticipantFace } from '@/hooks/useGroupBuyParticipantFaces';
import { cn } from '@/lib/utils';

interface ParticipantAvatarStackProps {
  faces: GroupBuyParticipantFace[];
  totalCount?: number | null;
  maxVisible?: number;
  sizeClassName?: string;
  className?: string;
  showRemainingLabel?: boolean;
}

function getInitials(name: string | null | undefined) {
  const cleanName = name?.trim();

  if (!cleanName) {
    return 'AJ';
  }

  const [first, second] = cleanName.split(/\s+/);
  return `${first?.[0] || ''}${second?.[0] || ''}`.toUpperCase() || 'AJ';
}

export function ParticipantAvatarStack({
  faces,
  totalCount = 0,
  maxVisible = 5,
  sizeClassName = 'h-7 w-7',
  className,
  showRemainingLabel = true,
}: ParticipantAvatarStackProps) {
  const visibleFaces = faces.slice(0, maxVisible);
  const placeholderCount = Math.max(0, Math.min(Number(totalCount || 0), maxVisible) - visibleFaces.length);
  const displayedCount = visibleFaces.length + placeholderCount;
  const remainingCount = Math.max(0, Number(totalCount || 0) - displayedCount);

  if (visibleFaces.length === 0 && placeholderCount === 0) {
    return null;
  }

  return (
    <div className={cn('flex min-w-0 items-center', className)}>
      <div className="flex min-w-0 -space-x-2 overflow-hidden">
        {visibleFaces.map((face) => (
          <Avatar
            key={face.participant_id}
            className={cn('border-2 border-background bg-primary/15 text-primary shadow-sm', sizeClassName)}
            title={face.display_name}
          >
            <AvatarImage src={face.avatar_url || undefined} alt={`${face.display_name} avatar`} />
            <AvatarFallback className="bg-primary/15 text-[10px] font-bold text-primary">
              {getInitials(face.display_name)}
            </AvatarFallback>
          </Avatar>
        ))}
        {Array.from({ length: placeholderCount }).map((_, index) => (
          <div
            key={`participant-placeholder-${index}`}
            className={cn(
              'flex items-center justify-center rounded-full border-2 border-background bg-primary/10 text-[10px] font-bold text-primary shadow-sm',
              sizeClassName,
            )}
          >
            {visibleFaces.length + index + 1}
          </div>
        ))}
      </div>
      {showRemainingLabel && remainingCount > 0 ? (
        <span className="ml-2 text-xs font-medium text-muted-foreground">+{remainingCount} more</span>
      ) : null}
    </div>
  );
}
