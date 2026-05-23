import type { Json } from '@/integrations/supabase/types';

export const GROUP_BUY_SETTINGS_STORE_KEY = 'group_buy_settings';

export const GROUP_BUY_SHIPPING_METHODS = [
  'air_shipping',
  'sea_shipping',
  'courier_delivery',
] as const;

export const GROUP_BUY_DURATION_UNITS = ['minutes', 'hours', 'days'] as const;

export const GROUP_BUY_REFUND_TRIGGERS = [
  'group_buy_failed',
  'supplier_unavailable',
  'admin_cancelled',
] as const;

export const GROUP_BUY_DISCOUNT_MODES = ['percentage', 'fixed_amount'] as const;

export const GROUP_BUY_STATUS_WORKFLOW_KEYS = [
  'payment_received',
  'confirmed',
  'order_placed',
  'order_processed',
  'processing',
  'packed_for_delivery',
  'shipped',
  'in_transit',
  'in_ghana',
  'ready_for_delivery',
  'handed_to_courier',
  'out_for_delivery',
  'delivered',
] as const;

export type GroupBuyShippingMethod = (typeof GROUP_BUY_SHIPPING_METHODS)[number];
export type GroupBuyDurationUnit = (typeof GROUP_BUY_DURATION_UNITS)[number];
export type GroupBuyRefundTrigger = (typeof GROUP_BUY_REFUND_TRIGGERS)[number];
export type GroupBuyDiscountMode = (typeof GROUP_BUY_DISCOUNT_MODES)[number];
export type GroupBuyStatusWorkflowKey = (typeof GROUP_BUY_STATUS_WORKFLOW_KEYS)[number];

export interface GroupBuyStatusWorkflowDefinition {
  key: GroupBuyStatusWorkflowKey;
  label: string;
  message: string;
}

export interface GroupBuyMilestoneDiscount {
  id: string;
  participants: number;
  mode: GroupBuyDiscountMode;
  amount: number;
}

export interface GroupBuyNotificationTemplates {
  confirmation: string;
  shippingUpdate: string;
  delayNotice: string;
  deliveryNotification: string;
  goalReached: string;
  expired: string;
  cancelled: string;
}

export interface GroupBuySettings {
  minParticipantsRequired: number;
  maxParticipantsAllowed: number;
  countdownDurationValue: number;
  countdownDurationUnit: GroupBuyDurationUnit;
  autoCloseWhenFull: boolean;
  autoConfirmWhenTargetReached: boolean;
  manualConfirmationRequired: boolean;
  visibleByDefault: boolean;
  featuredByDefault: boolean;
  participationOpen: boolean;
  allowPartialFulfillment: boolean;
  autoCancelUnpaidReservationsValue: number;
  autoCancelUnpaidReservationsUnit: GroupBuyDurationUnit;
  participantLimitPerUser: number;
  allowDuplicateParticipation: boolean;
  requireFullPaymentBeforeJoining: boolean;
  allowedShippingMethods: GroupBuyShippingMethod[];
  defaultShippingMethod: GroupBuyShippingMethod;
  fragileItemByDefault: boolean;
  reinforcedPackagingAvailable: boolean;
  shippingRestrictionNotes: string;
  statusWorkflow: GroupBuyStatusWorkflowDefinition[];
  notificationTemplates: GroupBuyNotificationTemplates;
  automaticParticipantNotifications: boolean;
  estimatedProcessingTimelineValue: number;
  estimatedProcessingTimelineUnit: GroupBuyDurationUnit;
  estimatedProcessingTimelineNotes: string;
  groupDiscountMode: GroupBuyDiscountMode;
  groupDiscountAmount: number;
  participantMilestoneDiscounts: GroupBuyMilestoneDiscount[];
  dynamicPricing: boolean;
  adminOverridePricing: boolean;
  shippingFeeOverride: number | null;
  refundEligibilityWindowValue: number;
  refundEligibilityWindowUnit: GroupBuyDurationUnit;
  allowAdminCancellation: boolean;
  automaticRefundTriggers: GroupBuyRefundTrigger[];
  cancellationReasonTemplates: string[];
}

type JsonRecord = Record<string, Json | undefined>;

const DEFAULT_STATUS_WORKFLOW: GroupBuyStatusWorkflowDefinition[] = [
  {
    key: 'payment_received',
    label: 'Payment Received',
    message: 'Your group-buy payment has been received successfully.',
  },
  {
    key: 'confirmed',
    label: 'Confirmed',
    message: 'Your group-buy order has been confirmed and queued for fulfillment.',
  },
  {
    key: 'order_placed',
    label: 'Supplier Processing',
    message: 'Your group-buy order has been secured with the supplier.',
  },
  {
    key: 'order_processed',
    label: 'Order Processed',
    message: 'Your group-buy items have been reviewed and prepared for dispatch.',
  },
  {
    key: 'processing',
    label: 'Processing',
    message: 'Your group-buy order is actively being processed.',
  },
  {
    key: 'packed_for_delivery',
    label: 'Packed for Delivery',
    message: 'Your group-buy order has been packed and is waiting for shipment.',
  },
  {
    key: 'shipped',
    label: 'Shipped',
    message: 'Your group-buy order has left the warehouse.',
  },
  {
    key: 'in_transit',
    label: 'In Transit',
    message: 'Your group-buy order is currently in transit.',
  },
  {
    key: 'in_ghana',
    label: 'In Ghana',
    message: 'Your group-buy shipment has arrived in Ghana.',
  },
  {
    key: 'ready_for_delivery',
    label: 'Ready for Delivery',
    message: 'Your group-buy order is ready for local delivery.',
  },
  {
    key: 'handed_to_courier',
    label: 'Handed to Courier',
    message: 'Your group-buy package has been handed to the courier.',
  },
  {
    key: 'out_for_delivery',
    label: 'Out for Delivery',
    message: 'Your group-buy package is on the way to you.',
  },
  {
    key: 'delivered',
    label: 'Delivered',
    message: 'Your group-buy order has been delivered successfully.',
  },
];

export const DEFAULT_GROUP_BUY_SETTINGS: GroupBuySettings = {
  minParticipantsRequired: 2,
  maxParticipantsAllowed: 100,
  countdownDurationValue: 48,
  countdownDurationUnit: 'hours',
  autoCloseWhenFull: true,
  autoConfirmWhenTargetReached: false,
  manualConfirmationRequired: true,
  visibleByDefault: true,
  featuredByDefault: false,
  participationOpen: true,
  allowPartialFulfillment: false,
  autoCancelUnpaidReservationsValue: 30,
  autoCancelUnpaidReservationsUnit: 'minutes',
  participantLimitPerUser: 1,
  allowDuplicateParticipation: false,
  requireFullPaymentBeforeJoining: true,
  allowedShippingMethods: [...GROUP_BUY_SHIPPING_METHODS],
  defaultShippingMethod: 'air_shipping',
  fragileItemByDefault: false,
  reinforcedPackagingAvailable: true,
  shippingRestrictionNotes: '',
  statusWorkflow: DEFAULT_STATUS_WORKFLOW,
  notificationTemplates: {
    confirmation: 'Your group-buy participation is confirmed.',
    shippingUpdate: 'Your group-buy order has a shipping update.',
    delayNotice: 'Your group-buy order has been delayed. We will keep you posted.',
    deliveryNotification: 'Your group-buy order is arriving soon.',
    goalReached: 'The group-buy target has been reached.',
    expired: 'This group buy expired before the target was reached.',
    cancelled: 'This group buy has been cancelled.',
  },
  automaticParticipantNotifications: true,
  estimatedProcessingTimelineValue: 5,
  estimatedProcessingTimelineUnit: 'days',
  estimatedProcessingTimelineNotes: '',
  groupDiscountMode: 'percentage',
  groupDiscountAmount: 0,
  participantMilestoneDiscounts: [
    { id: 'milestone-3', participants: 3, mode: 'percentage', amount: 5 },
    { id: 'milestone-5', participants: 5, mode: 'percentage', amount: 10 },
  ],
  dynamicPricing: false,
  adminOverridePricing: false,
  shippingFeeOverride: null,
  refundEligibilityWindowValue: 48,
  refundEligibilityWindowUnit: 'hours',
  allowAdminCancellation: true,
  automaticRefundTriggers: ['group_buy_failed', 'supplier_unavailable', 'admin_cancelled'],
  cancellationReasonTemplates: [
    'Target not reached before expiry.',
    'Supplier unavailable for fulfillment.',
    'Order cancelled by admin after review.',
  ],
};

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }

  return fallback;
}

function coerceString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function coercePositiveInteger(value: unknown, fallback: number, minimum = 1): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(minimum, Math.round(parsed));
}

function coerceNonNegativeNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, parsed);
}

function coerceNullableNumber(value: unknown, fallback: number | null): number | null {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

function coerceDurationUnit(value: unknown, fallback: GroupBuyDurationUnit): GroupBuyDurationUnit {
  return GROUP_BUY_DURATION_UNITS.includes(value as GroupBuyDurationUnit)
    ? (value as GroupBuyDurationUnit)
    : fallback;
}

function coerceShippingMethod(
  value: unknown,
  fallback: GroupBuyShippingMethod,
): GroupBuyShippingMethod {
  return GROUP_BUY_SHIPPING_METHODS.includes(value as GroupBuyShippingMethod)
    ? (value as GroupBuyShippingMethod)
    : fallback;
}

function coerceDiscountMode(value: unknown, fallback: GroupBuyDiscountMode): GroupBuyDiscountMode {
  return GROUP_BUY_DISCOUNT_MODES.includes(value as GroupBuyDiscountMode)
    ? (value as GroupBuyDiscountMode)
    : fallback;
}

function coerceShippingMethods(
  value: unknown,
  fallback: GroupBuyShippingMethod[],
): GroupBuyShippingMethod[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const methods = value.filter((entry): entry is GroupBuyShippingMethod =>
    GROUP_BUY_SHIPPING_METHODS.includes(entry as GroupBuyShippingMethod),
  );

  return methods.length > 0 ? methods : fallback;
}

function coerceRefundTriggers(
  value: unknown,
  fallback: GroupBuyRefundTrigger[],
): GroupBuyRefundTrigger[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const triggers = value.filter((entry): entry is GroupBuyRefundTrigger =>
    GROUP_BUY_REFUND_TRIGGERS.includes(entry as GroupBuyRefundTrigger),
  );

  return triggers.length > 0 ? triggers : fallback;
}

function coerceStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const entries = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return entries.length > 0 ? entries : fallback;
}

function coerceStatusWorkflow(
  value: unknown,
  fallback: GroupBuyStatusWorkflowDefinition[],
): GroupBuyStatusWorkflowDefinition[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const keyedFallback = new Map(fallback.map((item) => [item.key, item]));
  const workflow = value
    .map((entry) => {
      if (!isJsonRecord(entry)) {
        return null;
      }

      const key = GROUP_BUY_STATUS_WORKFLOW_KEYS.includes(entry.key as GroupBuyStatusWorkflowKey)
        ? (entry.key as GroupBuyStatusWorkflowKey)
        : null;

      if (!key) {
        return null;
      }

      const fallbackItem = keyedFallback.get(key) || fallback[0];
      return {
        key,
        label: coerceString(entry.label, fallbackItem.label),
        message: coerceString(entry.message, fallbackItem.message),
      };
    })
    .filter((entry): entry is GroupBuyStatusWorkflowDefinition => entry !== null);

  return workflow.length > 0 ? workflow : fallback;
}

function coerceNotificationTemplates(
  value: unknown,
  fallback: GroupBuyNotificationTemplates,
): GroupBuyNotificationTemplates {
  if (!isJsonRecord(value)) {
    return fallback;
  }

  return {
    confirmation: coerceString(value.confirmation, fallback.confirmation),
    shippingUpdate: coerceString(value.shippingUpdate, fallback.shippingUpdate),
    delayNotice: coerceString(value.delayNotice, fallback.delayNotice),
    deliveryNotification: coerceString(value.deliveryNotification, fallback.deliveryNotification),
    goalReached: coerceString(value.goalReached, fallback.goalReached),
    expired: coerceString(value.expired, fallback.expired),
    cancelled: coerceString(value.cancelled, fallback.cancelled),
  };
}

function coerceMilestoneDiscounts(
  value: unknown,
  fallback: GroupBuyMilestoneDiscount[],
): GroupBuyMilestoneDiscount[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const milestones = value
    .map((entry, index) => {
      if (!isJsonRecord(entry)) {
        return null;
      }

      const participants = coercePositiveInteger(entry.participants, NaN, 1);
      const amount = coerceNonNegativeNumber(entry.amount, NaN);
      if (!Number.isFinite(participants) || !Number.isFinite(amount)) {
        return null;
      }

      return {
        id: coerceString(entry.id, `milestone-${index + 1}`),
        participants,
        mode: coerceDiscountMode(entry.mode, 'percentage'),
        amount,
      };
    })
    .filter((entry): entry is GroupBuyMilestoneDiscount => entry !== null)
    .sort((left, right) => left.participants - right.participants);

  return milestones.length > 0 ? milestones : fallback;
}

export function parseGroupBuySettings(value: unknown): GroupBuySettings {
  const source = isJsonRecord(value) ? value : {};
  const fallback = DEFAULT_GROUP_BUY_SETTINGS;

  const allowedShippingMethods = coerceShippingMethods(
    source.allowedShippingMethods,
    fallback.allowedShippingMethods,
  );

  const defaultShippingMethod = coerceShippingMethod(
    source.defaultShippingMethod,
    fallback.defaultShippingMethod,
  );

  return {
    minParticipantsRequired: coercePositiveInteger(
      source.minParticipantsRequired,
      fallback.minParticipantsRequired,
      2,
    ),
    maxParticipantsAllowed: coercePositiveInteger(
      source.maxParticipantsAllowed,
      fallback.maxParticipantsAllowed,
      2,
    ),
    countdownDurationValue: coercePositiveInteger(
      source.countdownDurationValue,
      fallback.countdownDurationValue,
      1,
    ),
    countdownDurationUnit: coerceDurationUnit(
      source.countdownDurationUnit,
      fallback.countdownDurationUnit,
    ),
    autoCloseWhenFull: coerceBoolean(source.autoCloseWhenFull, fallback.autoCloseWhenFull),
    autoConfirmWhenTargetReached: coerceBoolean(
      source.autoConfirmWhenTargetReached,
      fallback.autoConfirmWhenTargetReached,
    ),
    manualConfirmationRequired: coerceBoolean(
      source.manualConfirmationRequired,
      fallback.manualConfirmationRequired,
    ),
    visibleByDefault: coerceBoolean(source.visibleByDefault, fallback.visibleByDefault),
    featuredByDefault: coerceBoolean(source.featuredByDefault, fallback.featuredByDefault),
    participationOpen: coerceBoolean(source.participationOpen, fallback.participationOpen),
    allowPartialFulfillment: coerceBoolean(
      source.allowPartialFulfillment,
      fallback.allowPartialFulfillment,
    ),
    autoCancelUnpaidReservationsValue: coercePositiveInteger(
      source.autoCancelUnpaidReservationsValue,
      fallback.autoCancelUnpaidReservationsValue,
      1,
    ),
    autoCancelUnpaidReservationsUnit: coerceDurationUnit(
      source.autoCancelUnpaidReservationsUnit,
      fallback.autoCancelUnpaidReservationsUnit,
    ),
    participantLimitPerUser: coercePositiveInteger(
      source.participantLimitPerUser,
      fallback.participantLimitPerUser,
      1,
    ),
    allowDuplicateParticipation: coerceBoolean(
      source.allowDuplicateParticipation,
      fallback.allowDuplicateParticipation,
    ),
    requireFullPaymentBeforeJoining: coerceBoolean(
      source.requireFullPaymentBeforeJoining,
      fallback.requireFullPaymentBeforeJoining,
    ),
    allowedShippingMethods,
    defaultShippingMethod: allowedShippingMethods.includes(defaultShippingMethod)
      ? defaultShippingMethod
      : allowedShippingMethods[0] || fallback.defaultShippingMethod,
    fragileItemByDefault: coerceBoolean(
      source.fragileItemByDefault,
      fallback.fragileItemByDefault,
    ),
    reinforcedPackagingAvailable: coerceBoolean(
      source.reinforcedPackagingAvailable,
      fallback.reinforcedPackagingAvailable,
    ),
    shippingRestrictionNotes: coerceString(
      source.shippingRestrictionNotes,
      fallback.shippingRestrictionNotes,
    ),
    statusWorkflow: coerceStatusWorkflow(source.statusWorkflow, fallback.statusWorkflow),
    notificationTemplates: coerceNotificationTemplates(
      source.notificationTemplates,
      fallback.notificationTemplates,
    ),
    automaticParticipantNotifications: coerceBoolean(
      source.automaticParticipantNotifications,
      fallback.automaticParticipantNotifications,
    ),
    estimatedProcessingTimelineValue: coercePositiveInteger(
      source.estimatedProcessingTimelineValue,
      fallback.estimatedProcessingTimelineValue,
      1,
    ),
    estimatedProcessingTimelineUnit: coerceDurationUnit(
      source.estimatedProcessingTimelineUnit,
      fallback.estimatedProcessingTimelineUnit,
    ),
    estimatedProcessingTimelineNotes: coerceString(
      source.estimatedProcessingTimelineNotes,
      fallback.estimatedProcessingTimelineNotes,
    ),
    groupDiscountMode: coerceDiscountMode(source.groupDiscountMode, fallback.groupDiscountMode),
    groupDiscountAmount: coerceNonNegativeNumber(
      source.groupDiscountAmount,
      fallback.groupDiscountAmount,
    ),
    participantMilestoneDiscounts: coerceMilestoneDiscounts(
      source.participantMilestoneDiscounts,
      fallback.participantMilestoneDiscounts,
    ),
    dynamicPricing: coerceBoolean(source.dynamicPricing, fallback.dynamicPricing),
    adminOverridePricing: coerceBoolean(source.adminOverridePricing, fallback.adminOverridePricing),
    shippingFeeOverride: coerceNullableNumber(
      source.shippingFeeOverride,
      fallback.shippingFeeOverride,
    ),
    refundEligibilityWindowValue: coercePositiveInteger(
      source.refundEligibilityWindowValue,
      fallback.refundEligibilityWindowValue,
      1,
    ),
    refundEligibilityWindowUnit: coerceDurationUnit(
      source.refundEligibilityWindowUnit,
      fallback.refundEligibilityWindowUnit,
    ),
    allowAdminCancellation: coerceBoolean(
      source.allowAdminCancellation,
      fallback.allowAdminCancellation,
    ),
    automaticRefundTriggers: coerceRefundTriggers(
      source.automaticRefundTriggers,
      fallback.automaticRefundTriggers,
    ),
    cancellationReasonTemplates: coerceStringArray(
      source.cancellationReasonTemplates,
      fallback.cancellationReasonTemplates,
    ),
  };
}

export function resolveGroupBuySettings(
  globalSettingsValue?: unknown,
  overrideValue?: unknown,
): GroupBuySettings {
  const baseSettings = parseGroupBuySettings(globalSettingsValue);
  return parseGroupBuySettings({
    ...baseSettings,
    ...(isJsonRecord(overrideValue) ? overrideValue : {}),
  });
}

export function sanitizeGroupBuySettings(
  value: GroupBuySettings | unknown,
): GroupBuySettings {
  return parseGroupBuySettings(value);
}

export function groupBuyDurationToMinutes(value: number, unit: GroupBuyDurationUnit): number {
  switch (unit) {
    case 'minutes':
      return value;
    case 'hours':
      return value * 60;
    case 'days':
      return value * 24 * 60;
    default:
      return value;
  }
}

export function groupBuyDurationToMilliseconds(
  value: number,
  unit: GroupBuyDurationUnit,
): number {
  return groupBuyDurationToMinutes(value, unit) * 60 * 1000;
}

export function formatGroupBuyDuration(
  value: number,
  unit: GroupBuyDurationUnit,
): string {
  const label =
    value === 1 ? unit.slice(0, -1) : unit;

  return `${value} ${label}`;
}

export function buildGroupBuySettingsSnapshot(
  settings: GroupBuySettings,
): GroupBuySettings {
  return sanitizeGroupBuySettings(settings);
}
