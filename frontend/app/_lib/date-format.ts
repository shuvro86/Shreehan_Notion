const ZONE = 'Asia/Dhaka';
const dateParts = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, day: '2-digit', month: 'short', year: 'numeric' });
const timeParts = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour: '2-digit', minute: '2-digit', hour12: false });

function asDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  // A date-only value is a calendar day, so pin it to midday in Dhaka.
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00+06:00` : value);
}

export function formatDate(value: string | Date): string {
  const date = asDate(value);
  if (Number.isNaN(date.getTime())) return typeof value === 'string' ? value : '';
  const parts = dateParts.formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value || '';
  return `${part('day')}-${part('month')}-${part('year')}`;
}

export function formatDateTime(value: string | Date): string {
  const date = asDate(value);
  return `${formatDate(date)} ${timeParts.format(date)}`;
}

export function todayInDhaka(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type: string) => parts.find(item => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
