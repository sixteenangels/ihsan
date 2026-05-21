interface GroupBuyCountdown {
  totalMs: number;
  totalMinutes: number;
  totalHours: number;
  days: number;
  hours: number;
  minutes: number;
  isExpired: boolean;
}

interface ExtendabilityInput {
  currentParticipants: number | null;
  expiresAt: string;
  extensionUsed: boolean | null | undefined;
  minParticipants: number;
  status: string | null;
}

interface LeaveWindowInput {
  currentParticipants: number | null;
  joinedAt: string;
  minParticipants: number;
  status: string | null;
}

export function getGroupBuyCountdown(
  expiresAt: string,
  nowInput: number = Date.now(),
): GroupBuyCountdown {
  const totalMs = new Date(expiresAt).getTime() - nowInput;
  const clampedMs = Math.max(0, totalMs);
  const totalMinutes = Math.floor(clampedMs / (1000 * 60));
  const totalHours = Math.floor(clampedMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  return {
    totalMs,
    totalMinutes,
    totalHours,
    days,
    hours,
    minutes,
    isExpired: totalMs <= 0,
  };
}

export function formatGroupBuyTimeRemaining(expiresAt: string): string {
  const countdown = getGroupBuyCountdown(expiresAt);

  if (countdown.isExpired) {
    return 'Expired';
  }

  if (countdown.days > 0) {
    return countdown.hours > 0
      ? `${countdown.days}d ${countdown.hours}h left`
      : `${countdown.days}d left`;
  }

  if (countdown.totalHours > 0) {
    return `${countdown.totalHours}h ${countdown.minutes}m left`;
  }

  return `${Math.max(1, countdown.totalMinutes)}m left`;
}

export function canExtendGroupBuy({
  currentParticipants,
  expiresAt,
  extensionUsed,
  minParticipants,
  status,
}: ExtendabilityInput): boolean {
  if (status !== 'open' || extensionUsed) {
    return false;
  }

  if ((currentParticipants || 0) >= minParticipants) {
    return false;
  }

  const countdown = getGroupBuyCountdown(expiresAt);
  return !countdown.isExpired && countdown.totalMinutes <= 60;
}

export function getLeaveWindowInfo({
  currentParticipants,
  joinedAt,
  minParticipants,
  status,
}: LeaveWindowInput) {
  const leaveDeadline = new Date(joinedAt).getTime() + (60 * 60 * 1000);
  const remainingMs = leaveDeadline - Date.now();
  const remainingMinutes = Math.max(0, Math.ceil(remainingMs / (1000 * 60)));
  const isGoalAlreadyMet = (currentParticipants || 0) >= minParticipants;
  const canLeave = status === 'open' && !isGoalAlreadyMet && remainingMs > 0;

  return {
    canLeave,
    remainingMinutes,
    leaveDeadline,
  };
}
