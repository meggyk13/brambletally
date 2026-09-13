// Minimal RFC 5545 VCALENDAR builder for the per-user focus-time feed.

// "2026-09-12 14:00:00" (stored UTC) -> "20260912T140000Z"
const icsDate = (sql) => String(sql).replace(/[-:]/g, '').replace(' ', 'T') + 'Z';

const icsText = (s) =>
  String(s == null ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

// Fold lines to <=75 octets per RFC 5545 (continuations start with a
// space). Measured in UTF-8 bytes, not JS string length (UTF-16 code
// units) — a note/project title with multi-byte characters (emoji,
// accented letters, CJK) could otherwise produce a folded line whose byte
// length exceeds the limit even though its character count didn't. RFC
// 5545 §3.1 also requires never splitting a multi-octet character across
// a fold boundary, hence backing the cut point off continuation bytes.
const foldEncoder = new TextEncoder();
const foldDecoder = new TextDecoder();

function byteBoundary(bytes, from, maxLen) {
  let end = Math.min(from + maxLen, bytes.length);
  while (end > from && (bytes[end] & 0xc0) === 0x80) end--;
  return end;
}

function fold(line) {
  const bytes = foldEncoder.encode(line);
  if (bytes.length <= 75) return line;
  const parts = [];
  let end = byteBoundary(bytes, 0, 75);
  parts.push(foldDecoder.decode(bytes.slice(0, end)));
  let start = end;
  while (bytes.length - start > 74) {
    end = byteBoundary(bytes, start, 74);
    parts.push(' ' + foldDecoder.decode(bytes.slice(start, end)));
    start = end;
  }
  if (start < bytes.length) parts.push(' ' + foldDecoder.decode(bytes.slice(start)));
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
