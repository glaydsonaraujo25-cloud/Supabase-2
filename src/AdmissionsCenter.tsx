import { useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabase";
import { fetchAll } from "./lib/data";
import ToolDialog from "./ToolDialog";
import type { ManagedChampionship } from "./RegulationsCenter";
type Request = {
  id: string;
  name: string;
  short_name: string | null;
  city: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
};
const labels = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Recusada",
};
export default function AdmissionsCenter({
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
  const [requests, setRequests] = useState<Request[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [name, setName] = useState(""),
    [short, setShort] = useState(""),
    [city, setCity] = useState(""),
    [limit, setLimit] = useState(20);
  const version = useRef(0);
  async function load() {
    const current = ++version.current;
    setLoading(true);
    setError("");
    try {
      const rows = await fetchAll(() =>
        supabase
          .from("team_requests")
          .select("id,name,short_name,city,status,created_at,reviewed_at")
          .eq("championship_id", championship.id)
          .order("created_at", { ascending: false })
          .order("id"),
      );
      if (current === version.current) setRequests(rows as Request[]);
    } catch (e) {
      if (current === version.current) setError((e as Error).message);
    } finally {
      if (current === version.current) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      version.current++;
    };
  }, [championship.id]);
  async function act(run: () => PromiseLike<{ error: unknown }>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await run();
      if (error) throw error;
      await reload();
      await load();
    } catch (e) {
      setError((e as Error).message || "Não foi possível concluir a operação.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <ToolDialog title="Inscrições de times" onClose={onClose} busy={busy}>
      <p>
        {championship.name} · Limite de {championship.max_teams} times
      </p>
      {isOwner ? (
        <>
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={!!championship.requires_team_approval}
              disabled={busy}
              onChange={(e) => {
                const checked = e.target.checked;
                void act(() =>
                  supabase
                    .from("championships")
                    .update({ requires_team_approval: checked })
                    .eq("id", championship.id)
                    .select("id")
                    .single(),
                );
              }}
            />
            Exigir aprovação dos novos times
          </label>
          <p>
            Abra o campeonato para receber e aprovar solicitações. Os
            participantes entram pelo código de convite e usam esta tela. Times
            já cadastrados não são alterados.
          </p>
        </>
      ) : (
        <p>
          Suas solicitações aparecem abaixo. A vaga só é ocupada após aprovação
          do organizador.
        </p>
      )}
      {!isOwner &&
        championship.requires_team_approval &&
        championship.status === "aberto" &&
        !requests.some((r) => r.status === "pending") && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void act(() =>
                supabase
                  .from("team_requests")
                  .insert({
                    championship_id: championship.id,
                    name: name.trim(),
                    short_name: short.trim() || null,
                    city: city.trim() || null,
                  })
                  .select("id")
                  .single(),
              );
            }}
          >
            <label>
              Nome do time
              <input
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
              />
            </label>
            <label>
              Sigla
              <input
                maxLength={12}
                value={short}
                onChange={(e) => setShort(e.target.value)}
                disabled={busy}
              />
            </label>
            <label>
              Cidade
              <input
                maxLength={100}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={busy}
              />
            </label>
            <button className="btn primary" disabled={busy}>
              Solicitar inscrição
            </button>
          </form>
        )}
      {!championship.requires_team_approval && (
        <p>
          A aprovação está desativada. O cadastro direto continua na aba Times e
          jogadores.
        </p>
      )}
      {championship.status !== "aberto" && (
        <p>Inscrições fechadas: o campeonato precisa estar no status Aberto.</p>
      )}
      {error && <p role="alert">{error}</p>}
      <button
        className="btn secondary"
        disabled={busy || loading}
        onClick={() => {
          setError("");
          void load();
        }}
      >
        Atualizar solicitações
      </button>
      {loading ? (
        <p role="status">Carregando solicitações…</p>
      ) : (
        <>
          <ul className="request-list">
            {requests.slice(0, limit).map((r) => (
              <li key={r.id}>
                <div>
                  <strong>{r.name}</strong>
                  <p>
                    {r.short_name || "Sem sigla"} ·{" "}
                    {r.city || "Cidade não informada"}
                  </p>
                  <small>
                    {labels[r.status]} ·{" "}
                    {new Date(r.created_at).toLocaleString("pt-BR")}
                  </small>
                </div>
                {r.status === "pending" && (
                  <div className="request-actions">
                    {isOwner ? (
                      <>
                        <button
                          className="btn primary"
                          disabled={busy}
                          onClick={() =>
                            void act(() =>
                              supabase
                                .from("team_requests")
                                .update({ status: "approved" })
                                .eq("id", r.id)
                                .eq("status", "pending")
                                .select("id")
                                .single(),
                            )
                          }
                        >
                          Aprovar
                        </button>
                        <button
                          className="btn secondary"
                          disabled={busy}
                          onClick={() =>
                            void act(() =>
                              supabase
                                .from("team_requests")
                                .update({ status: "rejected" })
                                .eq("id", r.id)
                                .eq("status", "pending")
                                .select("id")
                                .single(),
                            )
                          }
                        >
                          Recusar
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn secondary"
                        disabled={busy}
                        onClick={() =>
                          void act(() =>
                            supabase
                              .from("team_requests")
                              .delete()
                              .eq("id", r.id)
                              .eq("status", "pending")
                              .select("id")
                              .single(),
                          )
                        }
                      >
                        Retirar solicitação
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {!requests.length && <p>Nenhuma solicitação registrada.</p>}
          {requests.length > limit && (
            <button
              className="btn secondary"
              onClick={() => setLimit((n) => n + 20)}
            >
              Mostrar mais solicitações
            </button>
          )}
        </>
      )}
    </ToolDialog>
  );
}
