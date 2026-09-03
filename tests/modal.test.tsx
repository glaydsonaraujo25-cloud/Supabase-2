import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useModal } from "../src/lib/useModal";

it("mantém textarea na navegação circular e devolve o foco ao fechar", () => {
  const close = vi.fn();
  function Modal() {
    const ref = useModal(close);
    return (
      <section ref={ref}>
        <button>Primeiro</button>
        <textarea aria-label="Texto" />
      </section>
    );
  }
  const trigger = document.createElement("button");
  document.body.append(trigger);
  trigger.focus();
  const view = render(<Modal />);
  const first = screen.getByRole("button", { name: "Primeiro" });
  const last = screen.getByRole("textbox");
  fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(last);
  fireEvent.keyDown(last, { key: "Tab" });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: "Escape" });
  expect(close).toHaveBeenCalledOnce();
  view.unmount();
  expect(document.activeElement).toBe(trigger);
  trigger.remove();
});
