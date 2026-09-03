import { useState } from "react";
import { supabase } from "./lib/supabase";
import ToolDialog from "./ToolDialog";
export type ManagedChampionship = {
  id: string;
  name: string;
  status: string;
  max_teams: number;
  regulations?: string;
  requires_team_approval?: boolean;
};
export default function RegulationsCenter({
  championship,
  isOwner,
  onClose,
  reload,
}: {
  championship: ManagedChampionship;
  isOwner: boolean;
  onClose: () => void;
  reload: () => Promise<void>;
}) {
  const [rules, setRules] = useState(championship.regulations || ""),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState("");
  async function save() {
    if (busy) return;
    setBusy(true);
    setFeedback("");
    try {
      const { error } = await supabase
        .from("championships")
        .update({ regulations: rules.trim() })
        .eq("id", championship.id)
        .select("id")
        .single();
      if (error) throw error;
      await reload();
      setFeedback("Regulamento salvo.");
    } catch (e) {
      setFeedback((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <ToolDialog title="Regulamento" onClose={onClose} busy={busy}>
      <p>{championship.name}</p>
      {isOwner ? (
        <>
          <label>
            Regras e orientações
            <textarea
              rows={12}
              maxLength={20000}
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              disabled={busy}
            />
          </label>
          <p>
            {rules.length}/20000 caracteres. O texto será exibido na página
            pública se o campeonato estiver público.
          </p>
          <p>
            As regras escritas não alteram o cálculo automático dos pontos e
            desempates.
          </p>
          <button
            className="btn primary"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? "Salvando…" : "Salvar regulamento"}
          </button>
        </>
      ) : (
        <div className="regulations-text">
          {rules || "O organizador ainda não publicou o regulamento."}
        </div>
      )}
      {feedback && <p role="status">{feedback}</p>}
    </ToolDialog>
  );
}
