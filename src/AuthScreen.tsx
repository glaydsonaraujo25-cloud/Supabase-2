import { useState, type FormEvent } from "react";
import { Trophy } from "lucide-react";
import { siteUrl, supabase } from "./lib/supabase";
function message(error: { message: string; code?: string }) {
  const errors: Record<string, string> = {
    invalid_credentials: "E-mail ou senha incorretos.",
    email_not_confirmed: "Confirme seu e-mail antes de entrar.",
    user_already_exists:
      "Este e-mail já está cadastrado. Entre ou recupere sua senha.",
    over_email_send_rate_limit:
      "Aguarde alguns minutos antes de solicitar outro e-mail.",
    weak_password: "Escolha uma senha mais forte, com pelo menos 8 caracteres.",
    same_password: "Escolha uma senha diferente da atual.",
  };
  return (
    errors[error.code || ""] ||
    error.message ||
    "Não foi possível concluir. Tente novamente."
  );
}
export default function AuthScreen({
  initialMessage,
}: {
  initialMessage: string;
}) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login"),
    [fullName, setFullName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState(initialMessage),
    [resendAt, setResendAt] = useState(0);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (mode === "register" && password !== confirmation) {
      setFeedback("As senhas não coincidem.");
      return;
    }
    if (mode === "register" && fullName.trim().length < 3) {
      setFeedback("Informe seu nome completo.");
      return;
    }
    setBusy(true);
    setFeedback("");
    try {
      const address = email.trim();
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email: address,
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: `${siteUrl}/?confirmed=1`,
          },
        });
        if (error) throw error;
        setFeedback(
          data.user?.identities?.length === 0
            ? "Este e-mail pode já estar cadastrado. Entre ou recupere sua senha."
            : data.session
              ? "Conta criada."
              : "Confira seu e-mail para confirmar a conta. Se já possui cadastro, entre ou recupere sua senha.",
        );
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(address, {
          redirectTo: `${siteUrl}/?reset=1`,
        });
        if (error) throw error;
        setFeedback(
          "Se houver uma conta para esse e-mail, você receberá o link de recuperação.",
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: address,
          password,
        });
        if (error) throw error;
      }
    } catch (e) {
      setFeedback(message(e as Error));
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFeedback("Preencha um e-mail válido para reenviar a confirmação.");
      return;
    }
    if (Date.now() < resendAt) {
      setFeedback("Aguarde um minuto antes de reenviar.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: `${siteUrl}/?confirmed=1` },
      });
      if (error) throw error;
      setResendAt(Date.now() + 60000);
      setFeedback("Se a conta aguarda confirmação, um novo link será enviado.");
    } catch (e) {
      setFeedback(message(e as Error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-screen">
      <section className="auth-copy">
        <div className="auth-logo">
          <Trophy /> Bracketly
        </div>
        <h1>Organize e participe de campeonatos.</h1>
        <p>
          Crie competições, convide participantes e acompanhe cada resultado.
        </p>
      </section>
      <form className="auth-form" onSubmit={submit}>
        <p className="eyebrow">ACESSO</p>
        <h2>
          {mode === "login"
            ? "Entrar na sua conta"
            : mode === "register"
              ? "Criar sua conta"
              : "Recuperar senha"}
        </h2>
        {mode === "register" && (
          <label>
            Nome completo
            <input
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              minLength={3}
              required
            />
          </label>
        )}
        <label>
          E-mail
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        {mode !== "forgot" && (
          <>
            <label>
              Senha
              <input
                type={visible ? "text" : "password"}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={mode === "register" ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {mode === "register" && (
              <label>
                Confirmar senha
                <input
                  type={visible ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  required
                />
              </label>
            )}
            <button
              type="button"
              className="link-btn"
              aria-pressed={visible}
              onClick={() => setVisible((v) => !v)}
            >
              {visible ? "Ocultar senha" : "Mostrar senha"}
            </button>
          </>
        )}
        {feedback && (
          <p className="notice" role="status">
            {feedback}
          </p>
        )}
        <button className="btn primary" disabled={busy}>
          {busy
            ? "Processando…"
            : mode === "login"
              ? "Entrar"
              : mode === "register"
                ? "Cadastrar"
                : "Enviar link"}
        </button>
        {mode === "login" && (
          <button
            type="button"
            disabled={busy}
            className="link-btn"
            onClick={() => {
              setMode("forgot");
              setFeedback("");
            }}
          >
            Esqueci minha senha
          </button>
        )}
        {mode !== "forgot" && (
          <button
            type="button"
            disabled={busy}
            className="link-btn"
            onClick={() => void resend()}
          >
            Reenviar confirmação de e-mail
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          className="link-btn"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setFeedback("");
            setPassword("");
            setConfirmation("");
          }}
        >
          {mode === "login" ? "Ainda não tenho conta" : "Voltar para o login"}
        </button>
      </form>
    </div>
  );
}
