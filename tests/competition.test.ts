import { describe, it, expect } from "vitest";
import {
  calculateStandings,
  validScore,
  matchStatus,
} from "../src/lib/competition";
describe("competition rules", () => {
  it("excludes knockout and unfinished matches from league points", () => {
    const base = {
      home_team_id: "a",
      away_team_id: "b",
      home_score: 2,
      away_score: 0,
      status: "finalizado",
    };
    const rows = calculateStandings(
      [
        { id: "a", name: "Azul" },
        { id: "b", name: "Verde" },
      ],
      [
        base,
        { ...base, home_score: 0, away_score: 5, bracket_stage: "Final" },
        { ...base, status: "cancelado" },
      ],
    );
    expect(rows[0]).toMatchObject({
      points: 3,
      played: 1,
      goalsFor: 2,
      goalDiff: 2,
    });
    expect(rows[1]).toMatchObject({ points: 0, played: 1, losses: 1 });
  });
  it("does not silently turn an empty score into zero", () => {
    expect(validScore("")).toBe(false);
    expect(validScore(" ")).toBe(false);
    expect(validScore("-1")).toBe(false);
    expect(validScore("1.5")).toBe(false);
    expect(validScore("0")).toBe(true);
  });
  it("distinguishes cancelled and live matches", () => {
    expect(matchStatus("cancelado")).toBe("Cancelado");
    expect(matchStatus("em_andamento")).toBe("Em andamento");
  });
});

import { fetchAll } from "../src/lib/data";
it("reads records beyond the API page limit", async () => {
  const rows = Array.from({ length: 1001 }, (_, id) => ({ id }));
  const result = await fetchAll(() => ({
    range: async (a: number, b: number) => ({
      data: rows.slice(a, b + 1),
      error: null,
    }),
  }));
  expect(result).toHaveLength(1001);
  expect(result[1000]).toEqual({ id: 1000 });
});
