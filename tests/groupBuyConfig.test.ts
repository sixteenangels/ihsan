import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GROUP_BUY_SETTINGS,
  formatGroupBuyDuration,
  groupBuyDurationToMilliseconds,
  parseGroupBuySettings,
  resolveGroupBuySettings,
} from '@/lib/groupBuyConfig';

describe('group buy config helpers', () => {
  it('falls back to defaults when values are missing or invalid', () => {
    const settings = parseGroupBuySettings({
      minParticipantsRequired: 'bad',
      maxParticipantsAllowed: null,
      countdownDurationValue: -1,
      allowedShippingMethods: ['invalid'],
      defaultShippingMethod: 'invalid',
      participantMilestoneDiscounts: [],
    });

    expect(settings.minParticipantsRequired).toBe(DEFAULT_GROUP_BUY_SETTINGS.minParticipantsRequired);
    expect(settings.maxParticipantsAllowed).toBe(2);
    expect(settings.countdownDurationValue).toBe(1);
    expect(settings.allowedShippingMethods).toEqual(DEFAULT_GROUP_BUY_SETTINGS.allowedShippingMethods);
    expect(settings.defaultShippingMethod).toBe(DEFAULT_GROUP_BUY_SETTINGS.defaultShippingMethod);
    expect(settings.participantMilestoneDiscounts).toEqual(
      DEFAULT_GROUP_BUY_SETTINGS.participantMilestoneDiscounts,
    );
  });

  it('merges per-group overrides on top of global settings', () => {
    const settings = resolveGroupBuySettings(
      {
        visibleByDefault: false,
        participantLimitPerUser: 2,
        defaultShippingMethod: 'sea_shipping',
      },
      {
        visibleByDefault: true,
        participantLimitPerUser: 5,
      },
    );

    expect(settings.visibleByDefault).toBe(true);
    expect(settings.participantLimitPerUser).toBe(5);
    expect(settings.defaultShippingMethod).toBe('sea_shipping');
  });

  it('converts configurable durations into readable labels and milliseconds', () => {
    expect(formatGroupBuyDuration(24, 'hours')).toBe('24 hours');
    expect(formatGroupBuyDuration(1, 'days')).toBe('1 day');
    expect(groupBuyDurationToMilliseconds(2, 'hours')).toBe(2 * 60 * 60 * 1000);
    expect(groupBuyDurationToMilliseconds(3, 'days')).toBe(3 * 24 * 60 * 60 * 1000);
  });
});
