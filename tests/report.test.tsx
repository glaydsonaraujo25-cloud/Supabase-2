import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import Report, { type ReportProps } from "../src/ChampionshipReport";

const props: ReportProps = {
  championship: {
    id: "cup",
    name: "Copa de teste",
    format: "Pontos corridos",
    status: "em_andamento",
    sport: "Futebol",
  },
  teams: [
    { id: "t1", name: "Time Azul" },
    { id: "t2", name: "Time Verde" },
  ],
  players: [
    {
      id: "p1",
      team_id: "t1",
      name: "Jogador Dez",
      shirt_number: 10,
      position: "Meia",
    },
    {
      id: "p2",
      team_id: "t1",
      name: "Jogador Zero",
      shirt_number: 0,
      position: null,
    },
    { id: "p3", team_id: "t1", name: "Sem camisa", shirt_number: null },
    { id: "p4", team_id: "outro", name: "Outro campeonato", shirt_number: 1 },
  ],
  matches: [],
  events: [],
  onClose: vi.fn(),
};
it("inclui elencos por time sem misturar jogadores e ordena as camisas", () => {
  const original = structuredClone(props.players);
  render(<Report {...props} />);
  const table = screen.getByRole("table", { name: "Elenco de Time Azul" });
  const rows = within(table).getAllByRole("row");
  expect(rows[1].textContent).toContain("0Jogador ZeroNão informada");
  expect(rows[2].textContent).toContain("10Jogador DezMeia");
  expect(rows[3].textContent).toContain("—Sem camisa");
  expect(screen.queryByText("Outro campeonato")).toBeNull();
  expect(screen.getByText("Nenhum jogador cadastrado.")).toBeTruthy();
  expect(props.players).toEqual(original);
  expect(
    screen.getByText(/Esta lista não representa escalação confirmada/),
  ).toBeTruthy();
});
it("permite ocultar os elencos sem remover os resultados", () => {
  render(<Report {...props} />);
  fireEvent.click(screen.getByRole("checkbox", { name: "Incluir elencos" }));
  expect(
    screen.queryByRole("heading", { name: "Elencos dos times" }),
  ).toBeNull();
  expect(
    screen.getByRole("heading", { name: "Partidas e resultados" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("checkbox", { name: "Incluir elencos" }));
  expect(
    screen.getByRole("table", { name: "Elenco de Time Azul" }),
  ).toBeTruthy();
});
it.each([
  ["rascunho", "Rascunho"],
  ["aberto", "Inscrições abertas"],
  ["em_andamento", "Em andamento"],
  ["finalizado", "Finalizado"],
])("traduz o status %s", (status, label) => {
  render(
    <Report {...props} championship={{ ...props.championship, status }} />,
  );
  expect(screen.getByText(`Futebol · Pontos corridos · ${label}`)).toBeTruthy();
});
it("trata campeonato sem times", () => {
  render(<Report {...props} teams={[]} players={[]} />);
  const section = screen
    .getByRole("heading", { name: "Elencos dos times" })
    .closest("section")!;
  expect(within(section).getByText("Nenhum time cadastrado.")).toBeTruthy();
});
