export type AgendaMatch = {
  venue?: string | null;
  duration_minutes?: number | null;
  id: string;
  home_team_id: string;
  away_team_id: string;
  round: number;
  scheduled_at: string | null;
  status: string;
  bracket_stage?: string | null;
};
export function upcomingMatches(matches: AgendaMatch[], now: number) {
  return matches
    .filter(
      (m) =>
        m.status === "agendado" &&
        m.scheduled_at &&
        Number.isFinite(Date.parse(m.scheduled_at)) &&
        Date.parse(m.scheduled_at) >= now,
    )
    .sort(
      (a, b) =>
        Date.parse(a.scheduled_at!) - Date.parse(b.scheduled_at!) ||
        a.id.localeCompare(b.id),
    );
}
function textValue(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
}
function timestamp(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}
// RFC 5545 content lines are limited to 75 octets, without splitting UTF-8 characters.
export function foldCalendarLine(line: string) {
  const encoder = new TextEncoder();
  let result = "",
    length = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (length + bytes > 75) {
      result += "\r\n ";
      length = 1;
    }
    result += char;
    length += bytes;
  }
  return result;
}
export function buildCalendar(
  championship: { id: string; name: string },
  teams: { id: string; name: string }[],
  matches: AgendaMatch[],
  now = new Date(),
) {
  const names = new Map(teams.map((t) => [t.id, t.name]));
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bracketly//Agenda//PT-BR",
    "CALSCALE:GREGORIAN",
  ];
  for (const match of upcomingMatches(matches, now.getTime())) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${encodeURIComponent(championship.id)}-${encodeURIComponent(match.id)}@bracketly`,
      `DTSTAMP:${timestamp(now)}`,
      `DTSTART:${timestamp(new Date(match.scheduled_at!))}`,
      `SUMMARY:${textValue(`${names.get(match.home_team_id) || "Time"} × ${names.get(match.away_team_id) || "Time"}`)}`,
      `DESCRIPTION:${textValue(`${championship.name} · ${match.bracket_stage || `Rodada ${match.round}`}\nConfira alterações de horário no Bracketly. Esta cópia não atualiza automaticamente.`)}`,
      ...(match.venue ? [`LOCATION:${textValue(match.venue)}`] : []),
      ...(match.duration_minutes && match.duration_minutes > 0
        ? [
            `DTEND:${timestamp(new Date(Date.parse(match.scheduled_at!) + match.duration_minutes * 60000))}`,
          ]
        : []),
      "STATUS:CONFIRMED",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldCalendarLine).join("\r\n") + "\r\n";
}
export function downloadCalendar(content: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/calendar;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "bracketly-agenda.ics";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
