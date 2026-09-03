import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import StandingsTable from "../src/StandingsTable";
import { calculateStandings, type ScoreMatch } from "../src/lib/competition";

afterEach(cleanup);
const teams = [
  { id: "a", name: "Azul" },
  { id: "b", name: "Branco" },
  { id: "c", name: "Cinza" },
];
const base: ScoreMatch = {
  home_team_id: "a",
  away_team_id: "b",
  home_score: 2,
  away_score: 0,
  status: "finalizado",
};

describe("expanded standings", () => {
  it("calculates percentages for wins, draws and losses while distinguishing teams without games", () => {
    const rows = calculateStandings(teams, [
      base,
      { ...base, home_score: 1, away_score: 1 },
      { ...base, home_score: 0, away_score: 2 },
    ]);
    expect(rows.find((r) => r.team.id === "a")?.percentage).toBeCloseTo(
      400 / 9,
    );
    expect(rows.find((r) => r.team.id === "b")?.percentage).toBeCloseTo(
      400 / 9,
    );
    expect(rows.find((r) => r.team.id === "c")).toMatchObject({
      percentage: null,
      form: [],
    });
  });

  it("keeps five results by round, handles away results, and does not reorder the input", () => {
    const matches = [6, 1, 4, 2, 5, 3].map((round) => ({
      ...base,
      id: String(round),
      round,
      home_score: round % 2 ? 2 : 0,
    }));
    const before = matches.map((m) => m.round);
    const rows = calculateStandings(teams, matches);
    expect(matches.map((m) => m.round)).toEqual(before);
    expect(
      rows.find((r) => r.team.id === "a")?.form.map((g) => g.round),
    ).toEqual([2, 3, 4, 5, 6]);
    expect(
      rows.find((r) => r.team.id === "b")?.form.map((g) => g.result),
    ).toEqual(["E", "D", "E", "D", "E"]);
    expect(rows.find((r) => r.team.id === "b")?.form[1]).toMatchObject({
      opponent: "Azul",
      score: "0 × 2",
    });
  });

  it("excludes knockout, cancelled, unfinished and missing-score games from form and percentage", () => {
    const rows = calculateStandings(teams, [
      base,
      { ...base, bracket_stage: "Final" },
      { ...base, status: "cancelado" },
      { ...base, status: "em_andamento" },
      { ...base, home_score: null },
    ]);
    expect(rows[0]).toMatchObject({ played: 1, percentage: 100 });
    expect(rows[0].form).toHaveLength(1);
    expect(rows.find((r) => r.team.id === "b")?.percentage).toBe(0);
  });

  it("renders readable result descriptions, percentages and ranking rules", () => {
    render(
      <StandingsTable
        rows={calculateStandings(teams, [{ ...base, round: 1 }])}
      />,
    );
    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.getByText("0%")).toBeTruthy();
    expect(
      screen.getByLabelText("Vitória: 2 × 0 contra Branco · Rodada 1"),
    ).toBeTruthy();
    expect(screen.getByLabelText("Sem jogos finalizados")).toBeTruthy();
    expect(
      screen.getByText(/Ordem: pontos, vitórias, saldo de gols/),
    ).toBeTruthy();
  });
});
