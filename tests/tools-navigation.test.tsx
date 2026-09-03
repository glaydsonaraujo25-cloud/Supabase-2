import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ToolsNavigation from "../src/ToolsNavigation";

it("expande e recolhe ferramentas mantendo a associação acessível", () => {
  render(
    <ToolsNavigation>
      <button>Inscrições</button>
    </ToolsNavigation>,
  );
  const toggle = screen.getByRole("button", { name: "Ferramentas" });
  const target = document.getElementById(toggle.getAttribute("aria-controls")!);
  expect(target?.textContent).toContain("Inscrições");
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
});
it("não perde a ação escolhida ao abrir uma ferramenta", () => {
  const open = vi.fn();
  render(
    <ToolsNavigation>
      <button onClick={open}>Regulamento</button>
    </ToolsNavigation>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Ferramentas" }));
  fireEvent.click(screen.getByRole("button", { name: "Regulamento" }));
  expect(open).toHaveBeenCalledOnce();
  expect(
    screen
      .getByRole("button", { name: "Ferramentas" })
      .getAttribute("aria-expanded"),
  ).toBe("true");
});
