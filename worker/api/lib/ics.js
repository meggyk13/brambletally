// Minimal RFC 5545 VCALENDAR builder for the per-user focus-time feed.

// "2026-09-12 14:00:00" (stored UTC) -> "20260912T140000Z"
const icsDate = (sql) => String(sql).replace(/[-:]/g, '').replace(' ', 'T') + 'Z';

const icsText = (s) =>
  String(s == null ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

// Fold lines to <=75 octets per RFC 5545 (continuations start with a space).
function fold(line) {
  if (line.length <= 75) return line;
  const parts = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    parts.push(' ' + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length) parts.push(' ' + rest);
  return parts.join('\r\n');
}

// sessions: rows with { id, starts_at, ends_at, note, project_title }.
// origin: e.g. "https://brambletally.com" — deep links point at /app?focus=<id>.
export function buildCalendar(sessions, origin) {
  const stamp = icsDate(
    new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '')
  );
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Brambletally//Focus time//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Brambletally focus time',
  ];

  for (const s of sessions) {
    const link = `${origin}/app?focus=${s.id}`;
    const desc = icsText((s.note ? s.note + '\n\n' : '') + link);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${s.id}@brambletally.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(s.starts_at)}`,
      `DTEND:${icsDate(s.ends_at)}`,
      `SUMMARY:Focus — ${icsText(s.project_title || 'a project')}`,
      `DESCRIPTION:${desc}`,
      `URL:${link}`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  // Fold each logical line exactly once, at join time.
  return lines.map(fold).join('\r\n') + '\r\n';
}
