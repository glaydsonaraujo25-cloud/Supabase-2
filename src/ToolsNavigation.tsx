import { useId, useState, type ReactNode } from "react";
import "./tools-navigation.css";

export default function ToolsNavigation({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return (
    <div className="cm-tools" data-expanded={expanded}>
      <span className="cm-nav-section cm-tools-heading">FERRAMENTAS</span>
      <button
        type="button"
        className="cm-tools-toggle"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded((value) => !value)}
      >
        Ferramentas <span aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>
      <div id={id} className="cm-tools-list">
        {children}
      </div>
    </div>
  );
}
