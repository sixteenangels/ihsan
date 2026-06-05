export const ORDER_TRACKING_STATUS_DEFINITIONS = [
  {
    status: 'payment_received',
    label: 'Payment Received',
    defaultNote: "We've successfully received your payment and your order is now being prepared.",
  },
  {
    status: 'confirmed',
    label: 'Confirmed',
    defaultNote: "Your order has been reviewed and confirmed. We'll keep you updated as it progresses.",
  },
  {
    status: 'order_placed',
    label: 'Order Placed',
    defaultNote: 'Your order has been successfully placed and recorded in our system.',
  },
  {
    status: 'order_processed',
    label: 'Order Processed',
    defaultNote: 'Your order has been processed successfully and is ready for shipping.',
  },
  {
    status: 'shipped',
    label: 'Shipped',
    defaultNote: 'Your package has been shipped and is on its way.',
  },
  {
    status: 'in_transit',
    label: 'In Transit',
    defaultNote: 'Your package is currently on the move and making its way to Ghana.',
  },
  {
    status: 'in_ghana',
    label: 'In Ghana',
    defaultNote: 'Your package has arrived in Ghana and will be prepared for delivery.',
  },
  {
    status: 'processing',
    label: 'Processing',
    defaultNote: 'Your package is currently being prepared for delivery.',
  },
  {
    status: 'ready_for_delivery',
    label: 'Ready for Delivery',
    defaultNote: 'Your package is ready and will be handed over for delivery soon.',
  },
  {
    status: 'handed_to_courier',
    label: 'Handed to Courier',
    defaultNote: 'Your package has been handed over to our delivery partner.',
  },
  {
    status: 'out_for_delivery',
    label: 'Out for Delivery',
    defaultNote:
      'Your package is on its way to you. Please keep your phone nearby in case our delivery partner needs to contact you.',
  },
  {
    status: 'delivered',
    label: 'Delivered',
    defaultNote: 'Your order has been delivered successfully. Thank you for choosing AJYN.',
  },
  {
    status: 'cancelled',
    label: 'Cancelled',
    defaultNote: 'This order has been cancelled and will not proceed any further.',
  },
  {
    status: 'refunded',
    label: 'Refunded',
    defaultNote: 'Your refund has been processed successfully and returned to your original payment method.',
  },
] as const;

export type OfficialOrderTrackingStatus = (typeof ORDER_TRACKING_STATUS_DEFINITIONS)[number]['status'];

export const OFFICIAL_ORDER_TRACKING_STATUSES = ORDER_TRACKING_STATUS_DEFINITIONS.map(
  (definition) => definition.status,
) as OfficialOrderTrackingStatus[];

export const OFFICIAL_ORDER_TRACKING_STATUS_SET = new Set<string>(OFFICIAL_ORDER_TRACKING_STATUSES);

export const ORDER_TRACKING_STATUS_LABELS = ORDER_TRACKING_STATUS_DEFINITIONS.reduce(
  (labels, definition) => {
    labels[definition.status] = definition.label;
    return labels;
  },
  {} as Record<OfficialOrderTrackingStatus, string>,
);

export const ORDER_TRACKING_DEFAULT_NOTES = ORDER_TRACKING_STATUS_DEFINITIONS.reduce(
  (notes, definition) => {
    notes[definition.status] = definition.defaultNote;
    return notes;
  },
  {} as Record<OfficialOrderTrackingStatus, string>,
);

const STATUS_ALIASES: Record<string, OfficialOrderTrackingStatus | null> = {
  pending: null,
  packed: 'order_processed',
  packed_for_delivery: 'order_processed',
  courier: 'handed_to_courier',
  courier_handoff: 'handed_to_courier',
  with_courier: 'handed_to_courier',
};

const LEGACY_DEFAULT_NOTES: Partial<Record<OfficialOrderTrackingStatus, string[]>> = {
  payment_received: [
    "We've received your payment. Thank you!",
    'Payment received! Processing your order.',
    'Payment verified and order created securely.',
    'Order covered by wallet and loyalty credits.',
  ],
  confirmed: [
    'Your order has been confirmed.',
    'Your order has been confirmed!',
    'The order is confirmed and queued for fulfillment.',
  ],
  order_placed: [
    'Your order has been placed successfully.',
    'Your order has been placed successfully!',
  ],
  order_processed: [
    'Item verified and packed. Preparing for courier pickup.',
    'Item verified and prepared for courier pickup.',
    'The order has been packed and is ready to ship.',
    'Your order has been packed and is ready for shipping.',
    'Your order has been packed and ready for shipping!',
    'Group order packed and moved to the next fulfillment stage.',
  ],
  shipped: ['Your order has been shipped!', 'The order has been shipped.'],
  in_transit: [
    'Your order is on its way.',
    'Your order is in transit.',
    'The order is currently in transit.',
  ],
  in_ghana: ['Your order has arrived in Ghana!', 'The shipment has arrived in Ghana.'],
  processing: ['Your order is being processed.', 'The order is currently being processed.'],
  ready_for_delivery: [
    'Your order is ready for pickup/delivery.',
    'Your order is ready for delivery!',
    'The order is ready for final delivery.',
  ],
  handed_to_courier: [
    'Courier has picked up your package.',
    'Courier has picked up the package.',
    'Group order handed to the courier for delivery.',
  ],
  out_for_delivery: [
    'Your order is on the way to your location.',
    'Your order is out for delivery!',
    'The order is out for delivery.',
  ],
  delivered: ['Item received. Enjoy!', 'The order has been delivered.', 'Customer confirmed delivery.'],
  cancelled: ['Your order has been cancelled.', 'The order has been cancelled.'],
  refunded: [
    'Your order has been refunded.',
    'Your order has been refunded!',
    'Refund processed and recorded by support.',
  ],
};

function normalizeStatusInput(status: string) {
  return status.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function normalizeNoteText(note: string) {
  return note.replace(/\s+/g, ' ').trim().toLowerCase();
}

function stripKnownDefaultNote(status: OfficialOrderTrackingStatus, note: string) {
  let cleaned = note.trim();
  const defaultCandidates = [
    ORDER_TRACKING_DEFAULT_NOTES[status],
    ...(LEGACY_DEFAULT_NOTES[status] || []),
  ].filter(Boolean);

  for (const candidate of defaultCandidates) {
    const candidateText = candidate.trim();
    if (!candidateText) continue;

    if (normalizeNoteText(cleaned) === normalizeNoteText(candidateText)) {
      return '';
    }

    const separators = [' - ', '\n\n', '\n', ' '];
    for (const separator of separators) {
      const prefix = `${candidateText}${separator}`;
      if (cleaned.startsWith(prefix)) {
        cleaned = cleaned.slice(prefix.length).trim();
      }
    }
  }

  return cleaned;
}

export function normalizeOrderTimelineStatus(
  status: string | null | undefined,
): OfficialOrderTrackingStatus | null {
  if (!status) return null;

  const normalized = normalizeStatusInput(status);
  if (normalized in STATUS_ALIASES) {
    return STATUS_ALIASES[normalized];
  }

  return OFFICIAL_ORDER_TRACKING_STATUS_SET.has(normalized)
    ? (normalized as OfficialOrderTrackingStatus)
    : null;
}

export function getOfficialOrderStatusIndex(status: string | null | undefined) {
  const officialStatus = normalizeOrderTimelineStatus(status);
  return officialStatus ? OFFICIAL_ORDER_TRACKING_STATUSES.indexOf(officialStatus) : -1;
}

export function formatOfficialOrderStatusLabel(status: string | null | undefined) {
  const officialStatus = normalizeOrderTimelineStatus(status);
  if (officialStatus) return ORDER_TRACKING_STATUS_LABELS[officialStatus];
  if (!status) return 'Pending';
  return status.replaceAll('_', ' ');
}

export function getDefaultOrderTrackingNote(status: string | null | undefined) {
  const officialStatus = normalizeOrderTimelineStatus(status);
  return officialStatus ? ORDER_TRACKING_DEFAULT_NOTES[officialStatus] : '';
}

export function cleanOrderTrackingNoteForStorage(
  status: string | null | undefined,
  note: string | null | undefined,
) {
  if (!note) return '';
  const trimmed = note.trim();
  const officialStatus = normalizeOrderTimelineStatus(status);
  return officialStatus ? stripKnownDefaultNote(officialStatus, trimmed) : trimmed;
}

export function mergeOrderTrackingNotes(
  status: string | null | undefined,
  existingNote: string | null | undefined,
  nextNote: string | null | undefined,
) {
  const existing = cleanOrderTrackingNoteForStorage(status, existingNote);
  const next = cleanOrderTrackingNoteForStorage(status, nextNote);

  if (!next) return existing || null;
  if (!existing) return next;

  if (normalizeNoteText(existing).includes(normalizeNoteText(next))) {
    return existing;
  }

  return `${existing}\n\n${next}`;
}

export function getOrderTrackingDisplayNoteParts(
  status: string | null | undefined,
  note: string | null | undefined,
) {
  const defaultNote = getDefaultOrderTrackingNote(status);
  const customNote = cleanOrderTrackingNoteForStorage(status, note);
  return [defaultNote, customNote].filter(Boolean);
}

export function formatOrderTrackingDisplayNote(
  status: string | null | undefined,
  note: string | null | undefined,
) {
  return getOrderTrackingDisplayNoteParts(status, note).join('\n\n');
}
