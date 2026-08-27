// Shared Control Centre date/time formatting — single source of truth.
// Timestamps remain stored in UTC/ISO in the database; this only controls DISPLAY.
export const TIMEZONES = [
  'Australia/Melbourne', 'Australia/Sydney', 'Australia/Brisbane', 'Australia/Perth',
  'Pacific/Auckland', 'UTC', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Singapore',
];
export const DATE_FORMATS = ['DD-MM-YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'];

let PREFS = { tz: 'UTC', fmt: 'DD-MM-YYYY' };
export const setDateTimePrefs = (tz: string, fmt: string) => { PREFS = { tz, fmt }; };
export const getDateTimePrefs = () => PREFS;

export function fmtDT(iso?: string | null, dateOnly = false): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0, dateOnly ? 10 : 16).replace('T', ' ');
  try {
    const parts = new Intl.DateTimeFormat('en-AU', {
      timeZone: PREFS.tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short',
    }).formatToParts(d);
    const g = (t: string) => parts.find((p) => p.type === t)?.value || '';
    const dd = g('day'), mm = g('month'), yyyy = g('year');
    const date = PREFS.fmt === 'YYYY-MM-DD' ? `${yyyy}-${mm}-${dd}`
      : PREFS.fmt === 'DD/MM/YYYY' ? `${dd}/${mm}/${yyyy}` : `${dd}-${mm}-${yyyy}`;
    if (dateOnly) return date;
    // timeZoneName 'short' yields AEST/AEDT automatically with daylight saving.
    return `${date} ${g('hour')}:${g('minute')} ${g('timeZoneName')}`;
  } catch {
    return String(iso).slice(0, dateOnly ? 10 : 16).replace('T', ' ');
  }
}
