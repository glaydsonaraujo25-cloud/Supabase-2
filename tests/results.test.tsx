import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { championshipResult, topScorers } from "../src/lib/results";
import ChampionshipResults from "../src/ChampionshipResults";
afterEach(cleanup);
const teams = [
  { id: "a", name: "Azul" },
  { id: "b", name: "Branco" },
];
const match = {
  id: "m",
  championship_id: "c",
  home_team_id: "a",
  away_team_id: "b",
  status: "finalizado",
  home_score: 2,
  away_score: 0,
  round: 1,
};
describe("championship closing summary", () => {
  it("uses the league standings only after every pair has a completed game", () => {
    expect(
      championshipResult("Pontos corridos", teams, [match]).champion?.id,
    ).toBe("a");
    expect(
      championshipResult(
        "Pontos corridos",
        [...teams, { id: "c", name: "Cinza" }],
        [match],
      ).champion,
    ).toBeUndefined();
    expect(
      championshipResult("Pontos corridos", teams, [
        { ...match, status: "agendado" },
      ]).champion,
    ).toBeUndefined();
  });
  it("resolves the knockout final through penalties and refuses unresolved or cancelled finals", () => {
    const final = {
      ...match,
      bracket_stage: "Final",
      home_score: 1,
      away_score: 1,
      penalty_home_score: 3,
      penalty_away_score: 4,
    };
    expect(
      championshipResult("Grupos + mata-mata", teams, [final]),
    ).toMatchObject({ champion: teams[1], runnerUp: teams[0] });
    expect(
      championshipResult("Mata-mata", teams, [
        { ...final, penalty_home_score: 4 },
      ]).champion,
    ).toBeUndefined();
    expect(
      championshipResult("Mata-mata", teams, [
        { ...final, status: "cancelado" },
      ]).champion,
    ).toBeUndefined();
  });
  it("counts finished goals, excludes assists and cancelled games, and keeps tied leaders", () => {
    const players = [
      { id: "p", team_id: "a", name: "Ana", shirt_number: 9 },
      { id: "q", team_id: "b", name: "Bia", shirt_number: 10 },
    ];
    const event = {
      id: "e",
      match_id: "m",
      team_id: "a",
      player_id: "p",
      event_type: "goal",
      minute: 1,
    };
    const result = topScorers(
      players,
      [
        event,
        { ...event, id: "f", player_id: "q", team_id: "b" },
        { ...event, id: "g", event_type: "assist" },
        { ...event, id: "h", match_id: "cancelled" },
      ],
      [match, { ...match, id: "cancelled", status: "cancelado" }],
    );
    expect(result.map((r) => [r.player.name, r.goals])).toEqual([
      ["Ana", 1],
      ["Bia", 1],
    ]);
  });
  it("hides the summary before closure and shows pending results instead of a champion", () => {
    const championship = {
      id: "c",
      name: "Copa",
      format: "Pontos corridos",
      status: "aberto",
    };
    const { rerender } = render(
      <ChampionshipResults
        championship={championship}
        teams={teams}
        matches={[match]}
        players={[]}
        events={[]}
      />,
    );
    expect(screen.queryByLabelText("Resumo do campeonato")).toBeNull();
    rerender(
      <ChampionshipResults
        championship={{ ...championship, status: "finalizado" }}
        teams={teams}
        matches={[]}
        players={[]}
        events={[]}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain(
      "resultados pendentes",
    );
    expect(screen.queryByText("Campeão")).toBeNull();
  });
  it("displays the podium and keeps unavailable scorer data distinct from an empty ranking", () => {
    render(
      <ChampionshipResults
        championship={{
          id: "c",
          name: "Copa",
          format: "Pontos corridos",
          status: "finalizado",
        }}
        teams={teams}
        matches={[match]}
        players={[]}
        events={[]}
        error="Falha ao carregar"
        retry={() => {}}
      />,
    );
    expect(screen.getByText("Campeão")).toBeTruthy();
    expect(screen.getByText("Azul")).toBeTruthy();
    expect(screen.getByText("Vice-campeão")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain(
      "Falha ao carregar",
    );
  });
});
