export type HistoryEvent = { year?: number; text: string; region: 'Bangladesh' | 'World'; sourceUrl?: string };
type FeedEvent = { year?: number; text?: string; pages?: Array<{ titles?: { normalized?: string }; content_urls?: { desktop?: { page?: string } } }> };

// Date-specific national commemorations supplement the daily event feed.
const nationalDays: Record<string, HistoryEvent[]> = {
 '02-21': [{ text: "Language Martyrs' Day in Bangladesh honours the people who stood up for Bangla. Today is also International Mother Language Day.", region: 'Bangladesh', sourceUrl: 'https://bdembjp.mofa.gov.bd/public/storage/pdf/Country_Profile.pdf' }],
 '03-26': [{ year: 1971, text: "Bangladesh declared independence. This date is remembered as Independence Day.", region: 'Bangladesh', sourceUrl: 'https://beautifulbangladesh.gov.bd/district-event/dhaka/events/40' }],
 '12-16': [{ year: 1971, text: "Bangladesh achieved victory in the Liberation War. This date is celebrated as Victory Day.", region: 'Bangladesh', sourceUrl: 'https://beautifulbangladesh.gov.bd/district-event/dhaka/events/40' }],
};

export function dhakaDate(now = new Date()) {
 const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', month: '2-digit', day: '2-digit' }).formatToParts(now);
 return `${parts.find(p => p.type === 'month')!.value}-${parts.find(p => p.type === 'day')!.value}`;
}

export function selectHistory(date: string, raw: unknown): HistoryEvent[] {
 const feed = Array.isArray(raw) ? raw : [];
 const local = [...(nationalDays[date] || [])];
 const world: HistoryEvent[] = [];
 const seen = new Set(local.map(event => event.text.toLowerCase()));
 for (const item of feed) {
  if (!item || typeof item !== 'object') continue;
  const event = item as FeedEvent;
  if (typeof event.text !== 'string' || !event.text.trim()) continue;
  const text = event.text.trim();
  if (seen.has(text.toLowerCase())) continue;
  seen.add(text.toLowerCase());
  const pages = Array.isArray(event.pages) ? event.pages : [];
  const context = [text, ...pages.map(page => page?.titles?.normalized || '')].join(' ');
  const region = /\b(Bangladesh(?:i)?|East Pakistan|East Bengal|Dhaka|Dacca|Chittagong|Chattogram|Sheikh Mujibur Rahman)\b/i.test(context) ? 'Bangladesh' : 'World';
  const url = pages.find(page => page?.content_urls?.desktop?.page)?.content_urls?.desktop?.page;
  const sourceUrl = typeof url === 'string' && url.startsWith('https://en.wikipedia.org/') ? url : undefined;
  const normalized: HistoryEvent = { text, year: typeof event.year === 'number' ? event.year : undefined, region, sourceUrl };
  (region === 'Bangladesh' ? local : world).push(normalized);
 }
 return [...local, ...world.slice(0, 8)];
}
