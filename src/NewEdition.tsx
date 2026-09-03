import { useState } from "react";
import { supabase } from "./lib/supabase";
import ToolDialog from "./ToolDialog";
export default function NewEdition({
  championship,
  onClose,
  onCreated,
}: {
  championship: { id: string; name: string };
  onClose: () => void;
  onCreated: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState(
      `${championship.name} — Nova edição`.slice(0, 100),
    ),
    [copy, setCopy] = useState(true),
    [createdId, setCreatedId] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <ToolDialog title="Nova edição" onClose={onClose} busy={busy}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            let targetId = createdId;
            if (!targetId) {
              const { data, error } = await supabase.rpc(
                "create_championship_edition",
                {
                  p_source: championship.id,
                  p_name: name.trim(),
                  p_copy_teams: copy,
                },
              );
              if (error) throw error;
              targetId = data;
              setCreatedId(targetId);
            }
            if (!targetId)
              throw new Error(
                "A criação não retornou o identificador da edição.",
              );
            await onCreated(targetId);
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          O campeonato original será preservado. A nova edição começa como
          rascunho privado, com outro código de convite.
        </p>
        <label>
          Nome da nova edição
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={3}
            maxLength={100}
            required
            disabled={busy || !!createdId}
          />
        </label>
        <label className="checkbox-line">
          <input
            type="checkbox"
            checked={copy}
            onChange={(e) => setCopy(e.target.checked)}
            disabled={busy || !!createdId}
          />
          Copiar nomes, siglas e cidades dos times
        </label>
        <p>
          Modalidade, formato, regulamento e limite de vagas serão copiados.
          Jogadores, responsáveis, grupos, partidas e resultados não serão
          copiados.
        </p>
        {error && <p role="alert">{error}</p>}
        {createdId && (
          <p role="status">
            A edição já foi criada. Tente abrir novamente sem criar outra cópia.
          </p>
        )}
        <button className="btn primary" disabled={busy}>
          {busy
            ? createdId
              ? "Abrindo…"
              : "Criando…"
            : createdId
              ? "Abrir edição criada"
              : "Criar nova edição"}
        </button>
      </form>
    </ToolDialog>
  );
}
