import { it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  buildCalendar,
  upcomingMatches,
  foldCalendarLine,
} from "../src/lib/calendar";
import ChampionshipAgenda from "../src/ChampionshipAgenda";
const base = {
  id: "m1",
  home_team_id: "a",
  away_team_id: "b",
  round: 1,
  status: "agendado",
  scheduled_at: "2030-10-10T18:30:00-03:00",
};
const teams = [
  { id: "a", name: "Azul; Norte, Sul\nNova linha" },
  { id: "b", name: "União" },
];
it("exports UTC starts and escapes text without injecting calendar properties", () => {
  const calendar = buildCalendar(
    { id: "cup", name: "Copa teste" },
    teams,
    [base],
    new Date("2030-01-01T00:00:00Z"),
  );
  expect(calendar).toContain("DTSTART:20301010T213000Z\r\n");
  expect(calendar).toContain("Azul\\; Norte\\, Sul\\nNova linha");
  expect(calendar.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  expect(calendar).toContain("UID:cup-m1@bracketly");
  expect(calendar.endsWith("END:VCALENDAR\r\n")).toBe(true);
});
it("excludes undated, invalid, past, live and cancelled matches and sorts remaining games", () => {
  const matches = [
    base,
    { ...base, id: "earlier", scheduled_at: "2030-02-01T12:00:00Z" },
    { ...base, id: "cancel", status: "cancelado" },
    { ...base, id: "live", status: "em_andamento" },
    { ...base, id: "missing", scheduled_at: null },
    { ...base, id: "bad", scheduled_at: "invalid" },
    { ...base, id: "past", scheduled_at: "2000-01-01T00:00:00Z" },
  ];
  expect(
    upcomingMatches(matches, Date.parse("2030-01-01T00:00:00Z")).map(
      (m) => m.id,
    ),
  ).toEqual(["earlier", "m1"]);
});
it("folds long UTF-8 lines without breaking characters", () => {
  const source = "SUMMARY:" + "São João ⚽ ".repeat(25),
    folded = foldCalendarLine(source);
  expect(
    folded
      .split("\r\n")
      .every((line) => new TextEncoder().encode(line).length <= 75),
  ).toBe(true);
  expect(folded.replace(/\r\n /g, "")).toBe(source);
});
it("filters the agenda by team and disables empty exports", () => {
  render(
    <ChampionshipAgenda
      championship={{ id: "cup", name: "Copa" }}
      teams={[...teams, { id: "c", name: "Outro time" }]}
      matches={[{ ...base, scheduled_at: "2099-10-10T12:00:00Z" }]}
    />,
  );
  expect(
    (
      screen.getByRole("button", {
        name: "Baixar agenda (.ics)",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
  fireEvent.change(screen.getByLabelText("Agenda por time"), {
    target: { value: "c" },
  });
  expect(
    screen.getByText("Nenhuma partida futura agendada para esta seleção."),
  ).toBeTruthy();
  expect(
    (
      screen.getByRole("button", {
        name: "Baixar agenda (.ics)",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});
