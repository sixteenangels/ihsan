export const STORE_TIMEZONE = 'Africa/Accra';
export const STORE_LOCALE = 'en-GH';

function toValidDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Parse Postgres `date` values without UTC day-shift bugs. */
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
}

function shouldParseAsDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(value);
}

export function formatStoreDate(value: string | Date | null | undefined): string {
  if (typeof value === 'string' && shouldParseAsDateOnly(value)) {
    return new Intl.DateTimeFormat(STORE_LOCALE, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: STORE_TIMEZONE,
    }).format(parseDateOnly(value));
  }

  const date = toValidDate(value);
  if (!date) return '';

  return new Intl.DateTimeFormat(STORE_LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: STORE_TIMEZONE,
  }).format(date);
}

export function formatStoreDateTime(value: string | Date | null | undefined): string {
  const date = toValidDate(value);
  if (!date) return '';

  return new Intl.DateTimeFormat(STORE_LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: STORE_TIMEZONE,
  }).format(date);
}

export function formatStoreDateTimeCompact(value: string | Date | null | undefined): string {
  const date = toValidDate(value);
  if (!date) return '';

  return new Intl.DateTimeFormat(STORE_LOCALE, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: STORE_TIMEZONE,
  }).format(date);
}

export function formatStoreDeliveryWindow(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  if (!start || !end) return 'Pending';

  const startDate =
    typeof start === 'string' && start.includes('-') ? parseDateOnly(start) : toValidDate(start);
  const endDate = typeof end === 'string' && end.includes('-') ? parseDateOnly(end) : toValidDate(end);

  if (!startDate || !endDate) return 'Pending';

  const startLabel = new Intl.DateTimeFormat(STORE_LOCALE, {
    month: 'short',
    day: 'numeric',
    timeZone: STORE_TIMEZONE,
  }).format(startDate);
  const endLabel = formatStoreDate(end);

  return `${startLabel} - ${endLabel}`;
}

export function formatStoreDateIso(value: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: STORE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

export function formatStoreDateLong(value: string | Date | null | undefined): string {
  if (typeof value === 'string' && shouldParseAsDateOnly(value)) {
    return new Intl.DateTimeFormat(STORE_LOCALE, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: STORE_TIMEZONE,
    }).format(parseDateOnly(value));
  }

  const date = toValidDate(value);
  if (!date) return 'N/A';

  return new Intl.DateTimeFormat(STORE_LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: STORE_TIMEZONE,
  }).format(date);
}

export function formatStoreLocaleString(value: string | Date | null | undefined): string {
  return formatStoreDateTime(value);
}

export function formatStoreTime(value: string | Date | null | undefined): string {
  const date = toValidDate(value);
  if (!date) return '';

  return new Intl.DateTimeFormat(STORE_LOCALE, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: STORE_TIMEZONE,
  }).format(date);
}

/** Month and day only — useful for birthdays without year shift. */
export function formatStoreMonthDay(value: string | Date | null | undefined): string {
  if (typeof value === 'string' && shouldParseAsDateOnly(value)) {
    return new Intl.DateTimeFormat(STORE_LOCALE, {
      day: 'numeric',
      month: 'long',
      timeZone: STORE_TIMEZONE,
    }).format(parseDateOnly(value));
  }

  const date = toValidDate(value);
  if (!date) return '';

  return new Intl.DateTimeFormat(STORE_LOCALE, {
    day: 'numeric',
    month: 'long',
    timeZone: STORE_TIMEZONE,
  }).format(date);
}
