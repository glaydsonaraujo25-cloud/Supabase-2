import { useModal } from "./lib/useModal";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  CircleX,
  Crown,
  RefreshCw,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { supabase } from "./lib/supabase";

type Championship = { id: string; owner_id: string; name: string };
type Member = {
  id: string;
  championship_id: string;
  user_id: string;
  role: "participant" | "organizer";
  joined_at: string;
};
type Profile = { id: string; full_name: string; email?: string | null };
type Team = {
  id: string;
  championship_id: string;
  name: string;
  manager_user_id: string | null;
};

export default function ParticipantAdminCenter({
  championshipId,
  onClose,
}: {
  championshipId: string;
  onClose: () => void;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [open, setOpen] = useState(true);
  const [championships, setChampionships] = useState<Championship[]>([]);
  const [selectedId, setSelectedId] = useState(championshipId);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

  const modalRef = useModal(onClose, !!session);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) =>
      setSession(next),
    );
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user.id) void load();
  }, [session?.user.id]);

  async function load(preferred?: string) {
    if (!session?.user.id) return;
    setLoading(true);
    setFeedback("");
    const { data: owned, error: ownedError } = await supabase
      .from("championships")
      .select("id,owner_id,name")
      .eq("owner_id", session.user.id)
      .eq("id", championshipId)
      .order("created_at", { ascending: false });
    if (ownedError) {
      setFeedback(ownedError.message);
      setLoading(false);
      return;
    }
    const list = (owned || []) as Championship[];
    setChampionships(list);
    const next =
      preferred && list.some((c) => c.id === preferred)
        ? preferred
        : selectedId && list.some((c) => c.id === selectedId)
          ? selectedId
          : list[0]?.id || "";
    setSelectedId(next);
    if (!next) {
      setMembers([]);
      setProfiles([]);
      setTeams([]);
      setLoading(false);
      return;
    }
    const [
      { data: memberRows, error: memberError },
      { data: teamRows, error: teamError },
    ] = await Promise.all([
      supabase
        .from("championship_members")
        .select("*")
        .eq("championship_id", next)
        .order("joined_at"),
      supabase
        .from("teams")
        .select("id,championship_id,name,manager_user_id")
        .eq("championship_id", next)
        .order("name"),
    ]);
    if (memberError || teamError) {
      setFeedback((memberError || teamError)!.message);
      setLoading(false);
      return;
    }
    const ms = (memberRows || []) as Member[];
    setMembers(ms);
    setTeams((teamRows || []) as Team[]);
    const ids = ms.map((m) => m.user_id);
    if (ids.length) {
      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("id,full_name,email")
        .in("id", ids);
      if (profileError) setFeedback(profileError.message);
      setProfiles((profileRows || []) as Profile[]);
    } else setProfiles([]);
    setLoading(false);
  }

  async function changeChampionship(id: string) {
    setSelectedId(id);
    await load(id);
  }

  async function assignManager(teamId: string, userId: string) {
    setFeedback("");
    const { error } = await supabase
      .from("teams")
      .update({ manager_user_id: userId || null })
      .eq("id", teamId);
    if (error) setFeedback(error.message);
    else {
      setFeedback("Responsável do time atualizado.");
      await load(selectedId);
    }
  }

  async function removeMember(member: Member) {
    const profile = profiles.find((p) => p.id === member.user_id);
    if (
      !confirm(
        `Remover ${profile?.full_name || "este participante"} do campeonato?`,
      )
    )
      return;
    setFeedback("");
    const { error } = await supabase
      .from("championship_members")
      .delete()
      .eq("id", member.id);
    if (error) setFeedback(error.message);
    else {
      setFeedback(
        "Participante removido. Os times dele ficaram sem responsável.",
      );
      await load(selectedId);
    }
  }

  const selected = championships.find((c) => c.id === selectedId);
  const participants = useMemo(
    () => members.filter((m) => m.role === "participant"),
    [members],
  );
  const profile = (id: string) => profiles.find((p) => p.id === id);

  if (!session) return null;

  return (
    <>
      {open && (
        <div
          className="participant-admin-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <section
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-label="ParticipantAdminCenter"
            className="participant-admin-modal"
          >
            <header className="participant-admin-header">
              <div>
                <p>CENTRAL DO ORGANIZADOR</p>
                <h2>
                  <UserCog size={23} /> Participantes e responsáveis
                </h2>
              </div>
              <button
                className="participant-close"
                onClick={() => onClose()}
                aria-label="Fechar"
              >
                <CircleX size={22} />
              </button>
            </header>
            <div className="participant-admin-toolbar">
              <label>
                Campeonato
                <select
                  value={selectedId}
                  onChange={(e) => void changeChampionship(e.target.value)}
                >
                  {championships.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn secondary"
                onClick={() => void load(selectedId)}
              >
                <RefreshCw size={16} /> Atualizar
              </button>
            </div>
            {feedback && (
              <div className="notice participant-feedback">{feedback}</div>
            )}
            {loading ? (
              <div className="participant-loading">
                Carregando participantes…
              </div>
            ) : (
              <div className="participant-admin-content">
                <div className="participant-summary">
                  <div>
                    <Crown size={18} />
                    <span>
                      <strong>{selected?.name}</strong>
                      <small>
                        {participants.length} participante
                        {participants.length === 1 ? "" : "s"}
                      </small>
                    </span>
                  </div>
                  <div>
                    <ShieldCheck size={18} />
                    <span>
                      <strong>{teams.length}</strong>
                      <small>times cadastrados</small>
                    </span>
                  </div>
                </div>

                <section className="participant-section">
                  <div className="participant-section-head">
                    <div>
                      <p>USUÁRIOS</p>
                      <h3>Participantes do campeonato</h3>
                    </div>
                  </div>
                  {participants.length === 0 ? (
                    <div className="participant-empty">
                      Ainda não há participantes. Compartilhe o código de
                      convite do campeonato.
                    </div>
                  ) : (
                    <div className="participant-list">
                      {participants.map((member) => {
                        const p = profile(member.user_id);
                        const managedTeams = teams.filter(
                          (t) => t.manager_user_id === member.user_id,
                        );
                        return (
                          <article className="participant-row" key={member.id}>
                            <div className="participant-avatar">
                              {initials(p?.full_name || "P")}
                            </div>
                            <div className="participant-person">
                              <strong>{p?.full_name || "Participante"}</strong>
                              <small>{p?.email || member.user_id}</small>
                              <span>
                                {managedTeams.length
                                  ? `Responsável por: ${managedTeams.map((t) => t.name).join(", ")}`
                                  : "Sem time atribuído"}
                              </span>
                            </div>
                            <button
                              className="participant-remove"
                              onClick={() => void removeMember(member)}
                            >
                              <CircleX size={16} /> Remover
                            </button>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="participant-section">
                  <div className="participant-section-head">
                    <div>
                      <p>TIMES</p>
                      <h3>Definir responsáveis</h3>
                    </div>
                    <span>O organizador continua com acesso total.</span>
                  </div>
                  {teams.length === 0 ? (
                    <div className="participant-empty">
                      Cadastre os times antes de atribuir responsáveis.
                    </div>
                  ) : (
                    <div className="manager-list">
                      {teams.map((team) => (
                        <div className="manager-row" key={team.id}>
                          <strong>{team.name}</strong>
                          <select
                            value={team.manager_user_id || ""}
                            onChange={(e) =>
                              void assignManager(team.id, e.target.value)
                            }
                          >
                            <option value="">Sem responsável</option>
                            {participants.map((member) => (
                              <option key={member.id} value={member.user_id}>
                                {profile(member.user_id)?.full_name ||
                                  "Participante"}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
}
