import { useEffect, useMemo, useRef, useState } from "react";
import { fetchAll } from "./lib/data";
import { supabase } from "./lib/supabase";
import { auditChanges, auditTitle, type AuditEntry } from "./lib/audit";
import "./audit-center.css";
export default function AuditCenter({
  championshipId,
  onClose,
}: {
  championshipId: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [entries, setEntries] = useState<AuditEntry[]>([]),
    [profiles, setProfiles] = useState<Map<string, string>>(new Map()),
    [filter, setFilter] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await fetchAll(() =>
        supabase
          .from("audit_logs")
          .select("id,actor_id,entity,action,record_id,details,created_at")
          .eq("championship_id", championshipId)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false }),
      );
      const ids = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))];
      let names: Record<string, unknown>[] = [];
      if (ids.length) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id,full_name")
          .in("id", ids);
        if (error) throw error;
        names = data || [];
      }
      setEntries(rows as AuditEntry[]);
      setProfiles(
        new Map(
          names.map((p) => [String(p.id), String(p.full_name || "Usuário")]),
        ),
      );
    } catch (e) {
      setError(
        (e as Error).message || "Não foi possível carregar o histórico.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    dialog.current?.showModal();
    void load();
    return () => dialog.current?.close();
  }, [championshipId]);
  const visible = useMemo(
    () => entries.filter((e) => !filter || e.entity === filter),
    [entries, filter],
  );
  return (
    <dialog
      ref={dialog}
      className="audit-dialog"
      aria-labelledby="audit-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header>
        <div>
          <p className="eyebrow">AUDITORIA</p>
          <h2 id="audit-title">Histórico de alterações</h2>
        </div>
        <button
          className="icon-btn"
          aria-label="Fechar histórico"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="page-actions">
        <label>
          Filtrar{" "}
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Tudo</option>
            <option value="championships">Campeonato</option>
            <option value="teams">Times</option>
            <option value="players">Jogadores</option>
            <option value="matches">Partidas</option>
            <option value="match_events">Eventos</option>
          </select>
        </label>
        <button
          className="btn secondary"
          disabled={loading}
          onClick={() => void load()}
        >
          Atualizar
        </button>
      </div>
      {loading ? (
        <p role="status">Carregando histórico…</p>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <button className="btn secondary" onClick={() => void load()}>
            Tentar novamente
          </button>
        </div>
      ) : visible.length ? (
        <ol className="audit-list">
          {visible.map((entry) => (
            <li key={entry.id}>
              <header>
                <strong>{auditTitle(entry)}</strong>
                <time dateTime={entry.created_at}>
                  {new Date(entry.created_at).toLocaleString("pt-BR")}
                </time>
              </header>
              <p>
                Por{" "}
                {entry.actor_id
                  ? profiles.get(entry.actor_id) ||
                    "Usuário removido ou sem perfil"
                  : "Sistema ou usuário removido"}
              </p>
              {entry.action === "update" && (
                <ul>
                  {auditChanges(entry).map((c) => (
                    <li key={c.field}>
                      <b>{c.field}:</b> {c.before} → {c.after}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p>Nenhuma alteração registrada para este filtro.</p>
      )}
      <p className="muted">
        O histórico começa a partir da ativação desta função. Códigos de convite
        e identificadores de responsáveis não são armazenados nos detalhes.
      </p>
    </dialog>
  );
}
