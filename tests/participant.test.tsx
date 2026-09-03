import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
vi.mock("../src/lib/supabase", async () => await import("./fixtures"));
import Dashboard from "../src/ChampionshipDashboard";
import { db } from "./fixtures";

// UI-only fixtures: database authorization is tested separately by test:db.
const initial = structuredClone(db);
beforeEach(() => {
  Object.assign(db, structuredClone(initial));
  db.championships[0].owner_id = "other-organizer";
  db.championship_members.push({
    id: "membership",
    championship_id: "cup-preview",
    user_id: "owner-preview",
  });
});
afterEach(() => Object.assign(db, structuredClone(initial)));

it.each(["participante", "organizador"])(
  "bloqueia o formulário lotado para %s",
  async (role) => {
    if (role === "organizador") db.championships[0].owner_id = "owner-preview";
    db.championships[0].max_teams = db.teams.length;
    render(<Dashboard />);
    await screen.findByRole("heading", { name: "Copa da Comunidade" });
    fireEvent.click(screen.getByRole("button", { name: "Times e jogadores" }));
    const button = screen.getByRole("button", {
      name: "Adicionar",
      exact: true,
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("Vagas esgotadas");
    for (const label of ["Nome", "Sigla", "Cidade"]) {
      expect((screen.getByLabelText(label) as HTMLInputElement).disabled).toBe(
        true,
      );
    }
    const count = db.teams.length;
    fireEvent.submit(button.closest("form")!);
    expect(db.teams).toHaveLength(count);
    expect(screen.getByText("O limite de times foi atingido.")).toBeTruthy();
  },
);

it("reabilita o cadastro depois de atualizar a disponibilidade", async () => {
  db.championships[0].max_teams = db.teams.length;
  render(<Dashboard />);
  await screen.findByRole("heading", { name: "Copa da Comunidade" });
  fireEvent.click(screen.getByRole("button", { name: "Times e jogadores" }));
  expect(
    (
      screen.getByRole("button", {
        name: "Adicionar",
        exact: true,
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  db.championships[0].max_teams += 1;
  fireEvent.click(
    screen.getByRole("button", { name: "Atualizar", exact: true }),
  );
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Adicionar",
          exact: true,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  expect(screen.queryByText(/Vagas esgotadas/)).toBeNull();
  fireEvent.change(screen.getByLabelText("Nome"), {
    target: { value: "Time de teste isolado" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Adicionar", exact: true }),
  );
  await waitFor(() =>
    expect(
      db.teams.some(
        (t) =>
          t.name === "Time de teste isolado" &&
          t.manager_user_id === "owner-preview",
      ),
    ).toBe(true),
  );
});

it("mantém a edição do próprio time quando não há vagas", async () => {
  db.championships[0].max_teams = db.teams.length;
  db.teams[0].manager_user_id = "owner-preview";
  render(<Dashboard />);
  await screen.findByRole("heading", { name: "Copa da Comunidade" });
  fireEvent.click(screen.getByRole("button", { name: "Times e jogadores" }));
  expect(
    screen.queryByRole("button", { name: "Adicionar", exact: true }),
  ).toBeNull();
  expect(
    (
      screen.getByRole("button", {
        name: "Editar",
        exact: true,
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
});

it("mostra a área do participante sem ferramentas exclusivas do organizador", async () => {
  render(<Dashboard />);
  await screen.findByRole("heading", { name: "Copa da Comunidade" });
  expect(screen.getByText("ÁREA DO PARTICIPANTE")).toBeTruthy();
  for (const name of [
    "Participantes",
    "Compartilhar",
    "Histórico",
    "Nova edição",
  ]) {
    expect(screen.queryByRole("button", { name, exact: true })).toBeNull();
  }
  expect(
    screen.getByRole("button", { name: "Inscrições", exact: true }),
  ).toBeTruthy();
  expect(
    screen.getByRole("combobox", { name: "Campeonato selecionado" }),
  ).toBeTruthy();
});
it("permite editar somente o próprio time", async () => {
  db.teams[0].manager_user_id = "owner-preview";
  render(<Dashboard />);
  await screen.findByRole("heading", { name: "Copa da Comunidade" });
  fireEvent.click(screen.getByRole("button", { name: "Times e jogadores" }));
  expect(
    screen.getAllByRole("button", { name: "Editar", exact: true }),
  ).toHaveLength(1);
  expect(screen.getAllByRole("button", { name: "Excluir time" })).toHaveLength(
    1,
  );
  fireEvent.click(screen.getByRole("button", { name: "Editar", exact: true }));
  expect(
    (
      within(screen.getByRole("dialog")).getByLabelText(
        "Nome",
      ) as HTMLInputElement
    ).value,
  ).toBe("Estrela Azul");
});
it("direciona à inscrição quando aprovação é obrigatória", async () => {
  db.championships[0].requires_team_approval = true;
  db.championships[0].status = "aberto";
  render(<Dashboard />);
  await screen.findByRole("heading", { name: "Copa da Comunidade" });
  fireEvent.click(screen.getByRole("button", { name: "Times e jogadores" }));
  expect(screen.getByText(/Este campeonato exige aprovação/)).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Editar", exact: true }),
  ).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Inscrições", exact: true }),
  );
  await screen.findByRole("button", { name: "Solicitar inscrição" });
  expect(
    screen.queryByRole("checkbox", {
      name: "Exigir aprovação dos novos times",
    }),
  ).toBeNull();
});
it("exibe o regulamento em modo somente leitura", async () => {
  db.championships[0].regulations = "Respeite os horários.";
  render(<Dashboard />);
  await screen.findByRole("heading", { name: "Copa da Comunidade" });
  fireEvent.click(
    screen.getByRole("button", { name: "Regulamento", exact: true }),
  );
  await screen.findByText("Respeite os horários.");
  expect(within(screen.getByRole("dialog")).queryByRole("textbox")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Salvar regulamento" }),
  ).toBeNull();
});
