import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
vi.mock("../src/lib/supabase", async () => await import("./fixtures"));
import Dashboard from "../src/ChampionshipDashboard";
import { db } from "./fixtures";

const initial = structuredClone(db);
beforeEach(() => {
  Object.assign(db, structuredClone(initial));
  db.players.push({
    id: "p2",
    team_id: "t1",
    name: "João Teste",
    shirt_number: 7,
    position: "Atacante",
  });
});
afterEach(() => Object.assign(db, structuredClone(initial)));
async function openRoster() {
  render(<Dashboard />);
  await screen.findByRole("heading", { name: "Copa da Comunidade" });
  fireEvent.click(screen.getByRole("button", { name: "Times e jogadores" }));
  fireEvent.click(screen.getByRole("button", { name: /AZUL Estrela Azul/ }));
}

it.each(["joao", "ATACANTE", "7"])("busca jogadores por %s", async (query) => {
  await openRoster();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: query } });
  expect(screen.getByText("João Teste")).toBeTruthy();
  expect(screen.queryByText("Jogador de teste")).toBeNull();
  expect(screen.getByRole("status").textContent).toBe("1 de 2 jogadores");
});
it("distingue busca vazia de elenco vazio e limpa o filtro ao trocar time", async () => {
  await openRoster();
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "inexistente" },
  });
  expect(
    screen.getByText("Nenhum jogador encontrado para esta busca."),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /UNI União Verde/ }));
  expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("");
  expect(screen.getByText("Nenhum jogador cadastrado.")).toBeTruthy();
});
it("rejeita nome composto apenas por espaços sem gravar jogador", async () => {
  await openRoster();
  fireEvent.change(screen.getByLabelText("Nome do jogador"), {
    target: { value: "   " },
  });
  fireEvent.submit(screen.getByLabelText("Nome do jogador").closest("form")!);
  expect(screen.getByText("Informe o nome do jogador.")).toBeTruthy();
  expect(db.players).toHaveLength(2);
});
it("impede usar na edição a camisa de outro jogador do mesmo time", async () => {
  await openRoster();
  const row = screen
    .getByText("João Teste")
    .closest(".player-row") as HTMLElement;
  fireEvent.click(within(row).getByRole("button", { name: "Editar" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Camisa"), {
    target: { value: "10" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Salvar alterações" }),
  );
  await screen.findByText("Esse número de camisa já está em uso neste time.");
  expect(db.players.find((p) => p.id === "p2").shirt_number).toBe(7);
});
