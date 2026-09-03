import { describe, it, expect } from "vitest";
import { scheduleConflicts } from "../src/lib/scheduling";
import { buildCalendar } from "../src/lib/calendar";
const game = {
  id: "a",
  home_team_id: "one",
  away_team_id: "two",
  status: "agendado",
  scheduled_at: "2026-09-05T12:00:00Z",
  duration_minutes: 60,
  venue: "Quadra A",
  round: 1,
};
describe("match scheduling", () => {
  it("detects shared teams and normalized venues during overlapping intervals", () => {
    const other = {
      ...game,
      id: "b",
      home_team_id: "three",
      away_team_id: "four",
      venue: "  QUADRA   A ",
      scheduled_at: "2026-09-05T12:30:00Z",
    };
    expect(scheduleConflicts(game, [other])[0]).toMatchObject({
      sharedVenue: true,
      sharedTeam: false,
    });
    expect(
      scheduleConflicts(game, [
        { ...other, home_team_id: "one", venue: "Quadra B" },
      ])[0],
    ).toMatchObject({ sharedVenue: false, sharedTeam: true });
  });
  it("allows adjacent games, cancellations and independent courts and teams", () => {
    expect(
      scheduleConflicts(game, [
        game,
        { ...game, id: "b", status: "cancelado" },
        { ...game, id: "c", scheduled_at: "2026-09-05T13:00:00Z" },
        {
          ...game,
          id: "d",
          venue: "B",
          home_team_id: "three",
          away_team_id: "four",
        },
      ]),
    ).toEqual([]);
    expect(
      scheduleConflicts({ ...game, status: "cancelado" }, [
        { ...game, id: "e" },
      ]),
    ).toEqual([]);
  });
  it("does not invent duration for old games but detects known overlapping start times", () => {
    expect(
      scheduleConflicts({ ...game, duration_minutes: null }, [
        { ...game, id: "b", scheduled_at: "2026-09-05T11:30:00Z" },
      ]),
    ).toHaveLength(1);
    expect(
      scheduleConflicts({ ...game, duration_minutes: null }, [
        {
          ...game,
          id: "b",
          duration_minutes: null,
          scheduled_at: "2026-09-05T11:30:00Z",
        },
      ]),
    ).toEqual([]);
  });
  it("exports escaped location and explicit end time without adding a duration when absent", () => {
    const content = buildCalendar(
      { id: "c", name: "Copa" },
      [],
      [{ ...game, venue: "Quadra; A" }],
      new Date("2026-09-01"),
    );
    expect(content).toContain("LOCATION:Quadra\\; A\r\n");
    expect(content).toContain("DTEND:20260905T130000Z\r\n");
    expect(
      buildCalendar(
        { id: "c", name: "Copa" },
        [],
        [{ ...game, duration_minutes: null }],
        new Date("2026-09-01"),
      ),
    ).not.toContain("DTEND:");
  });
});
