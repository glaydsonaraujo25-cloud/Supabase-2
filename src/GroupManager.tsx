import { useState } from "react";
import { supabase } from "./lib/supabase";
import { distributeGroups, type GroupTeam } from "./lib/groups";
export default function GroupManager({
  championshipId,
  teams,
  locked,
  reload,
}: {
  championshipId: string;
  teams: GroupTeam[];
  locked: boolean;
  reload: () => Promise<void>;
}) {
  const [count, setCount] = useState(2);
  const [assignments, setAssignments] = useState<Record<string, string> | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const draft =
    assignments ??
    Object.fromEntries(teams.map((t) => [t.id, t.group_name || ""]));
  const names = [...new Set(Object.values(draft).filter(Boolean))].sort();
  const valid =
    [2, 4, 8].includes(names.length) &&
    teams.every((t) => !!draft[t.id]) &&
    names.every((g) => teams.filter((t) => draft[t.id] === g).length >= 2);
  async function save() {
    if (busy || !valid) return;
    setBusy(true);
    setFeedback("");
    try {
      const { error } = await supabase.rpc("configure_championship_groups", {
        p_championship: championshipId,
        p_assignments: Object.fromEntries(
          teams.map((t) => [t.id, draft[t.id]]),
        ),
      });
      if (error) throw error;
      await reload();
      setAssignments(null);
      setFeedback("Grupos salvos. Use Gerar rodadas na aba Partidas.");
    } catch (e) {
      setFeedback((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel group-manager">
      <h3>Distribuir times em grupos</h3>
      {locked ? (
        <p>
          A distribuição fica bloqueada enquanto houver partidas. Os resultados
          existentes foram preservados.
        </p>
      ) : (
        <>
          <p>
            Escolha 2, 4 ou 8 grupos, com pelo menos dois times por grupo. Você
            pode ajustar a distribuição antes de salvar.
          </p>
          <div className="page-actions">
            <label>
              Quantidade de grupos{" "}
              <select
                value={count}
                disabled={busy}
                onChange={(e) => setCount(Number(e.target.value))}
              >
                {[2, 4, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} grupos
                  </option>
                ))}
              </select>
            </label>
            <button
              className="btn secondary"
              disabled={busy || teams.length < count * 2}
              onClick={() => {
                setAssignments(distributeGroups(teams, count));
                setFeedback("");
              }}
            >
              Distribuir por ordem alfabética
            </button>
          </div>
          <div className="group-assignment-list">
            {teams.map((t) => (
              <label key={t.id}>
                {t.name}
                <select
                  aria-label={`Grupo de ${t.name}`}
                  disabled={busy}
                  value={draft[t.id] || ""}
                  onChange={(e) =>
                    setAssignments({ ...draft, [t.id]: e.target.value })
                  }
                >
                  <option value="">Sem grupo</option>
                  {"ABCDEFGH".split("").map((g) => (
                    <option key={g} value={g}>
                      Grupo {g}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p>
            {names
              .map(
                (g) =>
                  `Grupo ${g}: ${teams.filter((t) => draft[t.id] === g).length} times`,
              )
              .join(" · ") || "Cadastre os times e distribua os grupos."}
          </p>
          <button
            className="btn primary"
            disabled={busy || !valid}
            onClick={() => void save()}
          >
            {busy ? "Salvando…" : "Salvar grupos"}
          </button>
          {!valid && teams.length > 0 && (
            <p>
              Todos os times precisam de grupo; são necessários pelo menos dois
              times em cada grupo.
            </p>
          )}
        </>
      )}
      {feedback && <p role="status">{feedback}</p>}
    </section>
  );
}
