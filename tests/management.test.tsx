import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import NewEdition from "../src/NewEdition";
import RegulationsCenter from "../src/RegulationsCenter";
import ChampionshipReport from "../src/ChampionshipReport";

const db = vi.hoisted(() => ({
  rpc: vi.fn(),
  update: vi.fn(),
  single: vi.fn(),
}));
vi.mock("../src/lib/supabase", () => ({
  supabase: {
    rpc: db.rpc,
    from: () => ({
      update: (value: unknown) => {
        db.update(value);
        return { eq: () => ({ select: () => ({ single: db.single }) }) };
      },
    }),
  },
}));
const championship = {
  id: "original",
  name: "Copa",
  status: "aberto",
  max_teams: 8,
  format: "Liga",
  regulations: "<script>teste</script>",
};
beforeEach(() => {
  vi.clearAllMocks();
  db.rpc.mockResolvedValue({ data: "new-id", error: null });
  db.single.mockResolvedValue({ error: null });
});

describe("Gestão do campeonato", () => {
  it("cria uma edição sem copiar times quando solicitado", async () => {
    const created = vi.fn().mockResolvedValue(undefined),
      close = vi.fn();
    render(
      <NewEdition
        championship={championship}
        onCreated={created}
        onClose={close}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Criar nova edição" }));
    await waitFor(() => expect(created).toHaveBeenCalledWith("new-id"));
    expect(db.rpc).toHaveBeenCalledWith("create_championship_edition", {
      p_source: "original",
      p_name: "Copa — Nova edição",
      p_copy_teams: false,
    });
    expect(close).toHaveBeenCalledOnce();
  });
  it("mantém o formulário aberto quando a criação falha", async () => {
    db.rpc.mockResolvedValue({
      data: null,
      error: { message: "Sem permissão" },
    });
    const created = vi.fn(),
      close = vi.fn();
    render(
      <NewEdition
        championship={championship}
        onCreated={created}
        onClose={close}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Criar nova edição" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Sem permissão",
    );
    expect(created).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
  it("participante lê texto escapado sem controles de edição", () => {
    render(
      <RegulationsCenter
        championship={championship}
        isOwner={false}
        onClose={() => {}}
        reload={async () => {}}
      />,
    );
    expect(screen.getByText(championship.regulations)).toBeTruthy();
    expect(document.querySelector("script")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
  it("salva apenas o regulamento e recarrega os dados", async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    render(
      <RegulationsCenter
        championship={championship}
        isOwner
        onClose={() => {}}
        reload={reload}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: " Regras novas " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar regulamento" }));
    await screen.findByText("Regulamento salvo.");
    expect(db.update).toHaveBeenCalledWith({ regulations: "Regras novas" });
    expect(reload).toHaveBeenCalledOnce();
  });
  it("abre impressão do relatório e permite fechar", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {}),
      close = vi.fn();
    render(
      <ChampionshipReport
        championship={championship}
        teams={[]}
        matches={[]}
        players={[]}
        events={[]}
        onClose={close}
      />,
    );
    expect(screen.getByText(championship.regulations)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Imprimir / Salvar PDF" }),
    );
    expect(print).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Fechar relatório" }));
    expect(close).toHaveBeenCalledOnce();
    print.mockRestore();
  });
});
