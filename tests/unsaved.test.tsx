import { afterEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import EditDialog from "../src/EditDialog";
import ToolDialog from "../src/ToolDialog";

afterEach(() => vi.restoreAllMocks());
it("confirma descarte no cancelamento e no Escape, preservando edição ao recusar", () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false),
    close = vi.fn();
  render(
    <EditDialog
      title="Editar"
      values={{ name: "Time" }}
      fields={[{ name: "name", label: "Nome" }]}
      onSave={async () => {}}
      onClose={close}
    />,
  );
  fireEvent.change(screen.getByLabelText("Nome"), {
    target: { value: "Outro" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(close).not.toHaveBeenCalled();
  expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe(
    "Outro",
  );
  confirm.mockReturnValue(true);
  fireEvent(
    screen.getByRole("dialog"),
    new Event("cancel", { bubbles: true, cancelable: true }),
  );
  expect(close).toHaveBeenCalledOnce();
  expect(confirm).toHaveBeenCalledTimes(2);
});
it("não confirma quando os valores foram restaurados", () => {
  const confirm = vi.spyOn(window, "confirm"),
    close = vi.fn();
  render(
    <EditDialog
      title="Editar"
      values={{ name: "Time" }}
      fields={[{ name: "name", label: "Nome" }]}
      onSave={async () => {}}
      onClose={close}
    />,
  );
  fireEvent.change(screen.getByLabelText("Nome"), {
    target: { value: "Outro" },
  });
  fireEvent.change(screen.getByLabelText("Nome"), {
    target: { value: "Time" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(confirm).not.toHaveBeenCalled();
  expect(close).toHaveBeenCalledOnce();
});
it("instala aviso de saída somente enquanto há alterações", () => {
  const view = render(
    <ToolDialog title="Teste" onClose={() => {}} dirty>
      Conteúdo
    </ToolDialog>,
  );
  const changed = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(changed);
  expect(changed.defaultPrevented).toBe(true);
  view.rerender(
    <ToolDialog title="Teste" onClose={() => {}}>
      Conteúdo
    </ToolDialog>,
  );
  const saved = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(saved);
  expect(saved.defaultPrevented).toBe(false);
});
it("bloqueia fechamento enquanto salva", () => {
  const confirm = vi.spyOn(window, "confirm"),
    close = vi.fn();
  render(
    <ToolDialog title="Teste" onClose={close} busy dirty>
      Conteúdo
    </ToolDialog>,
  );
  fireEvent(
    screen.getByRole("dialog"),
    new Event("cancel", { cancelable: true }),
  );
  expect(confirm).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
});
