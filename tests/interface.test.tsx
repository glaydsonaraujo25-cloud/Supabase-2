import { it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
vi.mock("../src/lib/supabase", async () => await import("./fixtures"));
import Dashboard from "../src/ChampionshipDashboard";
import AuthScreen from "../src/AuthScreen";
it("opens selected championship tools and edits a team", async () => {
  render(<Dashboard />);
  await screen.findByRole("heading", { name: "Copa da Comunidade" });
  expect(screen.queryByRole("table")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Times e jogadores" }));
  const edit = screen.getAllByRole("button", { name: "Editar" })[0];
  fireEvent.click(edit);
  const dialog = screen.getByRole("dialog", { name: "Editar time" });
  fireEvent.change(within(dialog).getByLabelText("Nome"), {
    target: { value: "Estrela Renovada" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Salvar alterações" }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByText("Estrela Renovada")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Compartilhar" }));
  await screen.findByText("Página pública ativa");
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Classificação" }));
  await screen.findByRole("table");
  expect(screen.getByRole("table").textContent).toContain("Estrela Renovada");
});
it("rejects mismatching passwords before calling registration", () => {
  render(<AuthScreen initialMessage="" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Ainda não tenho conta" }),
  );
  fireEvent.change(screen.getByLabelText("Nome completo"), {
    target: { value: "Pessoa Teste" },
  });
  fireEvent.change(screen.getByLabelText("E-mail"), {
    target: { value: "teste@example.invalid" },
  });
  fireEvent.change(screen.getByLabelText("Senha", { exact: true }), {
    target: { value: "example123" },
  });
  fireEvent.change(screen.getByLabelText("Confirmar senha"), {
    target: { value: "different123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Cadastrar" }));
  expect(screen.getByRole("status").textContent).toContain(
    "As senhas não coincidem",
  );
  fireEvent.click(screen.getByRole("button", { name: "Mostrar senha" }));
  expect(
    screen.getByLabelText("Senha", { exact: true }).getAttribute("type"),
  ).toBe("text");
});

import PublicChampionship from "../src/PublicChampionship";
import { db } from "./fixtures";
it("shows cancelled matches accurately on the public page", async () => {
  db.matches.push({
    ...db.matches[0],
    id: "cancelled",
    status: "cancelado",
    home_score: null,
    away_score: null,
  });
  render(<PublicChampionship slug="preview" />);
  await screen.findByRole("heading", { name: "Copa da Comunidade" });
  expect(screen.getAllByText(/Cancelado/).length).toBeGreaterThan(0);
  expect(screen.getByRole("table").textContent).toContain("Estrela Renovada");
  db.matches.pop();
});

it("reschedules and cancels a match, then filters the updated list", async () => {
  const original = { ...db.matches[0] };
  try {
    render(<Dashboard />);
    await screen.findByRole("heading", { name: "Copa da Comunidade" });
    fireEvent.click(
      screen.getByRole("button", { name: "Partidas", exact: true }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Gerenciar partida" }));
    const dialog = screen.getByRole("dialog", { name: "Gerenciar partida" });
    fireEvent.change(within(dialog).getByLabelText("Data e horário"), {
      target: { value: "2026-10-10T15:30" },
    });
    fireEvent.change(within(dialog).getByLabelText("Status da partida"), {
      target: { value: "cancelado" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Salvar partida" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(db.matches[0].status).toBe("cancelado");
    expect(db.matches[0].scheduled_at).toBe(
      new Date("2026-10-10T15:30").toISOString(),
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Salvar",
          exact: true,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.change(screen.getByLabelText("Filtrar por status"), {
      target: { value: "agendado" },
    });
    expect(screen.getByText("Nenhuma partida com esses filtros")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(
      screen.getByRole("button", { name: "Gerenciar partida" }),
    ).toBeTruthy();
  } finally {
    db.matches[0] = original;
  }
});
