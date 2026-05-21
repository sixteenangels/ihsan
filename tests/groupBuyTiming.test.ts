import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  canExtendGroupBuy,
  formatGroupBuyTimeRemaining,
  getLeaveWindowInfo,
} from '@/lib/groupBuyTiming';

describe('group buy timing helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-21T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats shorter windows in hours and minutes', () => {
    expect(formatGroupBuyTimeRemaining('2026-05-21T15:30:00.000Z')).toBe('3h 30m left');
    expect(formatGroupBuyTimeRemaining('2026-05-21T12:20:00.000Z')).toBe('20m left');
  });

  it('only allows one extension during the final hour for unfilled open group buys', () => {
    expect(
      canExtendGroupBuy({
        currentParticipants: 1,
        expiresAt: '2026-05-21T12:45:00.000Z',
        extensionUsed: false,
        minParticipants: 2,
        status: 'open',
      }),
    ).toBe(true);

    expect(
      canExtendGroupBuy({
        currentParticipants: 2,
        expiresAt: '2026-05-21T12:45:00.000Z',
        extensionUsed: false,
        minParticipants: 2,
        status: 'open',
      }),
    ).toBe(false);

    expect(
      canExtendGroupBuy({
        currentParticipants: 1,
        expiresAt: '2026-05-21T14:30:00.000Z',
        extensionUsed: false,
        minParticipants: 2,
        status: 'open',
      }),
    ).toBe(false);
  });

  it('locks leaving after the first hour or once the goal is met', () => {
    expect(
      getLeaveWindowInfo({
        currentParticipants: 1,
        joinedAt: '2026-05-21T11:20:00.000Z',
        minParticipants: 3,
        status: 'open',
      }).canLeave,
    ).toBe(true);

    expect(
      getLeaveWindowInfo({
        currentParticipants: 1,
        joinedAt: '2026-05-21T10:20:00.000Z',
        minParticipants: 3,
        status: 'open',
      }).canLeave,
    ).toBe(false);

    expect(
      getLeaveWindowInfo({
        currentParticipants: 3,
        joinedAt: '2026-05-21T11:20:00.000Z',
        minParticipants: 3,
        status: 'open',
      }).canLeave,
    ).toBe(false);
  });
});
