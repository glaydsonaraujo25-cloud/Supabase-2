import { useModal } from "./lib/useModal";
import { useEffect, useState } from "react";
import { Copy, Globe2, X } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { siteUrl, supabase } from "./lib/supabase";

type Item = {
  id: string;
  name: string;
  is_public: boolean;
  public_slug: string;
};

export default function SharingCenter({
  championshipId,
  onClose,
}: {
  championshipId: string;
  onClose: () => void;
}) {
  const [session, setSession] = useState<Session | null>(null),
    [open, setOpen] = useState(true),
    [items, setItems] = useState<Item[]>([]),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState("");
  const modalRef = useModal(onClose, !!session);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (session) void load();
  }, [session?.user.id]);
  async function load() {
    if (!session?.user.id) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("championships")
      .select("id,name,is_public,public_slug")
      .eq("owner_id", session.user.id)
      .eq("id", championshipId)
      .order("created_at", { ascending: false });
    if (error) setFeedback(error.message);
    else setItems((data || []) as Item[]);
    setBusy(false);
  }
  async function show() {
    setOpen(true);
    setFeedback("");
    await load();
  }
  async function toggle(item: Item) {
    setFeedback("");
    const { error } = await supabase
      .from("championships")
      .update({
        is_public: !item.is_public,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    if (error) setFeedback(error.message);
    else await load();
  }
  async function copy(item: Item) {
    const url = `${siteUrl}/?public=${item.public_slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setFeedback("Link público copiado.");
    } catch {
      setFeedback("Não foi possível copiar. Link: " + url);
    }
  }
  return (
    <>
      {open && (
        <div className="share-backdrop" onClick={() => onClose()}>
          <section
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-label="SharingCenter"
            className="share-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <div>
                <p className="eyebrow">PÁGINA PÚBLICA</p>
                <h2>Compartilhar campeonato</h2>
              </div>
              <button
                aria-label="Fechar"
                className="icon-btn"
                onClick={() => onClose()}
              >
                <X size={18} />
              </button>
            </header>
            <p className="muted">
              Ative apenas os campeonatos que você quer que qualquer pessoa
              possa acompanhar sem login.
            </p>
            {feedback && <div className="notice">{feedback}</div>}
            {busy ? (
              <p>Carregando…</p>
            ) : items.length === 0 ? (
              <p className="muted">Você ainda não criou campeonatos.</p>
            ) : (
              <div className="share-list">
                {items.map((i) => (
                  <article key={i.id}>
                    <div>
                      <strong>{i.name}</strong>
                      <small>
                        {i.is_public
                          ? "Página pública ativa"
                          : "Somente usuários do campeonato"}
                      </small>
                    </div>
                    <label className="share-switch">
                      <input
                        type="checkbox"
                        checked={i.is_public}
                        onChange={() => void toggle(i)}
                      />
                      <span />
                    </label>
                    {i.is_public && (
                      <button
                        className="btn secondary small"
                        onClick={() => void copy(i)}
                      >
                        <Copy size={15} /> Copiar link
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
