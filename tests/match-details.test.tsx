import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import MatchDetails from "../src/MatchDetails";
import PrivateMatchDetails from "../src/PrivateMatchDetails";
const { fetchAll } = vi.hoisted(() => ({ fetchAll: vi.fn() }));
vi.mock("../src/lib/data", () => ({ fetchAll }));
vi.mock("../src/lib/supabase", () => ({ supabase: {} }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const match = {
  id: "m",
  championship_id: "c",
  home_team_id: "a",
  away_team_id: "b",
  round: 1,
  status: "finalizado",
  home_score: 2,
  away_score: 1,
  scheduled_at: null,
};
const teams = [
  { id: "a", name: "Azul", group_name: "A" },
  { id: "b", name: "Branco", group_name: "A" },
];
const players = [{ id: "p", team_id: "a", name: "Ana", shirt_number: 9 }];
const event = {
  id: "e",
  match_id: "m",
  team_id: "a",
  player_id: "p",
  event_type: "goal",
  minute: 12,
};
describe("match details", () => {
  it("shows only this match's events in minute order and the current rosters", () => {
    render(
      <MatchDetails
        match={match}
        teams={teams}
        players={players}
        events={[
          { ...event, id: "late", minute: null },
          { ...event, id: "other", match_id: "other", minute: 0 },
          event,
          { ...event, id: "early", minute: 0, event_type: "yellow_card" },
        ]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByLabelText("Placar").textContent).toBe("2 × 1");
    const records = within(screen.getByText("0′").closest("ol")!).getAllByRole(
      "listitem",
    );
    expect(records).toHaveLength(3);
    expect(records.map((r) => r.querySelector("b")?.textContent)).toEqual([
      "0′",
      "12′",
      "Sem minuto",
    ]);
    expect(screen.getByText("#9 Ana")).toBeTruthy();
    expect(screen.getByText(/não confirma quem participou/)).toBeTruthy();
  });
  it("distinguishes preserved cancelled scores and knockout penalties", () => {
    render(
      <MatchDetails
        match={{
          ...match,
          status: "cancelado",
          bracket_stage: "Final",
          penalty_home_score: 4,
          penalty_away_score: 3,
        }}
        teams={teams}
        players={[]}
        events={[]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/Placar preservado/)).toBeTruthy();
    expect(screen.getByText("Pênaltis: 4 × 3")).toBeTruthy();
    expect(
      screen.getByText("Nenhum evento registrado nesta partida."),
    ).toBeTruthy();
  });
  it("closes via the button or Escape cancellation", () => {
    const close = vi.fn();
    render(
      <MatchDetails
        match={match}
        teams={teams}
        players={[]}
        events={[]}
        onClose={close}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Fechar detalhes" }));
    fireEvent(
      screen.getByRole("dialog"),
      new Event("cancel", { bubbles: false }),
    );
    expect(close).toHaveBeenCalledTimes(2);
  });
  it("shows a recoverable error instead of presenting missing records as an empty match", async () => {
    fetchAll
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([]);
    render(
      <PrivateMatchDetails match={match} teams={teams} onClose={() => {}} />,
    );
    await screen.findByRole("alert");
    expect(
      screen.queryByText("Nenhum evento registrado nesta partida."),
    ).toBeNull();
    fetchAll.mockResolvedValueOnce([event]).mockResolvedValueOnce(players);
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByText("Gol");
    expect(screen.getByText("#9 Ana")).toBeTruthy();
  });
});
