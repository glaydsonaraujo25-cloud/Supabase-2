import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { distributeGroups, groupTables } from "../src/lib/groups";
import GroupStandings from "../src/GroupStandings";
import GroupManager from "../src/GroupManager";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../src/lib/supabase", () => ({ supabase: { rpc } }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const teams = [
  { id: "a", name: "Azul", group_name: "A" },
  { id: "b", name: "Branco", group_name: "A" },
  { id: "c", name: "Cinza", group_name: "B" },
  { id: "d", name: "Dourado", group_name: "B" },
];
const game = {
  home_team_id: "a",
  away_team_id: "b",
  home_score: 2,
  away_score: 0,
  status: "finalizado",
  round: 1,
};
describe("independent groups", () => {
  it("keeps points separate and ignores knockout and cross-group matches", () => {
    const groups = groupTables(teams, [
      game,
      { ...game, away_team_id: "c" },
      { ...game, home_score: 99, bracket_stage: "Final" },
    ]);
    expect(groups[0].rows[0]).toMatchObject({ points: 3, goalsFor: 2 });
    expect(groups[1].rows.every((r) => r.points === 0)).toBe(true);
    expect(groups.map((g) => g.complete)).toEqual([true, false]);
  });
  it("does not declare qualification for missing or cancelled fixtures", () => {
    expect(
      groupTables(teams, [{ ...game, status: "cancelado" }])[0].complete,
    ).toBe(false);
    expect(
      groupTables(
        [...teams, { id: "e", name: "Extra", group_name: "A" }],
        [game],
      )[0].complete,
    ).toBe(false);
  });
  it("balances the alphabetical distribution and shows provisional qualification", () => {
    expect(distributeGroups([...teams].reverse(), 2)).toEqual({
      a: "A",
      b: "B",
      c: "A",
      d: "B",
    });
    render(<GroupStandings teams={teams} matches={[game]} />);
    expect(screen.getByText("Grupo A")).toBeTruthy();
    expect(screen.getByText("Grupo B")).toBeTruthy();
    expect(screen.getByText(/Classificados: Azul e Branco/)).toBeTruthy();
    expect(
      screen.getByText(
        /Nas posições de classificação \(provisório\): Cinza e Dourado/,
      ),
    ).toBeTruthy();
  });
  it("saves the complete editable distribution and reloads only after success", async () => {
    rpc.mockResolvedValue({ error: null });
    const reload = vi.fn().mockResolvedValue(undefined);
    render(
      <GroupManager
        championshipId="champ"
        teams={teams.map((t) => ({ ...t, group_name: null }))}
        locked={false}
        reload={reload}
      />,
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Salvar grupos",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(
      screen.getByRole("button", { name: "Distribuir por ordem alfabética" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Salvar grupos" }));
    await waitFor(() => expect(reload).toHaveBeenCalledOnce());
    expect(rpc).toHaveBeenCalledWith("configure_championship_groups", {
      p_championship: "champ",
      p_assignments: { a: "A", b: "B", c: "A", d: "B" },
    });
  });
  it("preserves the draft after a server failure and locks existing fixtures", async () => {
    rpc.mockResolvedValue({ error: { message: "Partidas já cadastradas" } });
    const reload = vi.fn();
    const { rerender } = render(
      <GroupManager
        championshipId="champ"
        teams={teams}
        locked={false}
        reload={reload}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Salvar grupos" }));
    await screen.findByText("Partidas já cadastradas");
    expect(reload).not.toHaveBeenCalled();
    rerender(
      <GroupManager
        championshipId="champ"
        teams={teams}
        locked
        reload={reload}
      />,
    );
    expect(screen.queryByRole("button", { name: "Salvar grupos" })).toBeNull();
  });
});
