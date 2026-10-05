// Heure locale du Maroc (Africa/Casablanca), utilisée par l'application et le serveur.
export const AGENCY_TZ = 'Africa/Casablanca';

const pad = (n: number) => String(n).padStart(2, '0');

export interface ZonedNow {
  iso: string; // 2026-10-05T19:30:00+01:00
  date: string; // 2026-10-05
  hour: number;
  weekday: string; // الإثنين
}

export function zoned(date: Date = new Date(), tz = AGENCY_TZ): ZonedNow {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  const local = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offsetMin = Math.round((local - Math.floor(date.getTime() / 1000) * 1000) / 60000);
  const abs = Math.abs(offsetMin);
  const offset = `${offsetMin >= 0 ? '+' : '-'}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  return {
    iso: `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`,
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: +parts.hour,
    weekday: new Intl.DateTimeFormat('ar-MA', { weekday: 'long', timeZone: tz }).format(date),
  };
}

export const localDay = (iso: string, tz = AGENCY_TZ) => zoned(new Date(iso), tz).date;

export const fmtTime = (iso: string, tz = AGENCY_TZ) =>
  new Intl.DateTimeFormat('fr-MA', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(new Date(iso));

export const fmtDayTime = (iso: string, tz = AGENCY_TZ) =>
  new Intl.DateTimeFormat('ar-MA', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(new Date(iso));
