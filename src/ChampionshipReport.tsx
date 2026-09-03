import { createPortal } from "react-dom";
import { useState } from "react";
import { useModal } from "./lib/useModal";
import { calculateStandings, matchStatus } from "./lib/competition";
import { groupTables, hasGroups } from "./lib/groups";
import { topScorers } from "./lib/results";
import ChampionshipResults, { type ResultsProps } from "./ChampionshipResults";
import StandingsTable from "./StandingsTable";
import "./championship-report.css";
export type ReportProps = ResultsProps & {
  championship: ResultsProps["championship"] & {
    sport?: string;
    regulations?: string;
  };
  onClose: () => void;
};
export default function ChampionshipReport(props: ReportProps) {
  const [includeRosters, setIncludeRosters] = useState(true);
  const { championship, teams, matches, players, events, onClose } = props,
    ref = useModal(onClose);
  const tables = hasGroups(teams)
    ? groupTables(teams, matches)
    : [
        {
          name: "Classificação geral",
          rows: calculateStandings(teams, matches),
        },
      ];
  const names = new Map(teams.map((t) => [t.id, t.name]));
  const scorers = topScorers(players, events, matches);
  const status =
    (
      {
        rascunho: "Rascunho",
        aberto: "Inscrições abertas",
        em_andamento: "Em andamento",
        finalizado: "Finalizado",
      } as Record<string, string>
    )[championship.status] || "Status não informado";
  return createPortal(
    <section
      ref={ref}
      className="championship-report"
      role="dialog"
      aria-modal="true"
      aria-label="Relatório do campeonato"
    >
      <div className="report-toolbar">
        <button className="btn primary" onClick={() => window.print()}>
          Imprimir / Salvar PDF
        </button>
        <button className="btn secondary" onClick={onClose}>
          Fechar relatório
        </button>
        <label>
          <input
            type="checkbox"
            checked={includeRosters}
            onChange={(e) => setIncludeRosters(e.target.checked)}
          />
          Incluir elencos
        </label>
        <p>
          Na janela de impressão, escolha Salvar como PDF. O relatório inclui
          todos os jogos, sem os filtros da tela.
        </p>
      </div>
      <header>
        <h1>{championship.name}</h1>
        <p>
          {championship.sport} · {championship.format} · {status}
        </p>
        <p>
          Emitido em {new Date().toLocaleString("pt-BR")} · {teams.length} times
          · {matches.length} partidas
        </p>
      </header>
      <ChampionshipResults {...props} />
      {championship.format !== "Mata-mata" &&
        tables.map((group) => (
          <section key={group.name}>
            <h2>{hasGroups(teams) ? `Grupo ${group.name}` : group.name}</h2>
            <StandingsTable rows={group.rows} />
          </section>
        ))}
      <section>
        <h2>Partidas e resultados</h2>
        {matches.length ? (
          <div className="report-table">
            <table>
              <thead>
                <tr>
                  <th>Fase</th>
                  <th>Confronto</th>
                  <th>Placar</th>
                  <th>Status</th>
                  <th>Horário e local</th>
                </tr>
              </thead>
              <tbody>
                {[...matches]
                  .sort((a, b) => a.round - b.round || a.id.localeCompare(b.id))
                  .map((m) => (
                    <tr key={m.id}>
                      <td>{m.bracket_stage || `Rodada ${m.round}`}</td>
                      <td>
                        {names.get(m.home_team_id) || "Time removido"} ×{" "}
                        {names.get(m.away_team_id) || "Time removido"}
                      </td>
                      <td>
                        {m.home_score ?? "—"} × {m.away_score ?? "—"}
                        {m.penalty_home_score != null &&
                          m.penalty_away_score != null && (
                            <small>
                              {" "}
                              (pênaltis {m.penalty_home_score} ×{" "}
                              {m.penalty_away_score})
                            </small>
                          )}
                      </td>
                      <td>{matchStatus(m.status)}</td>
                      <td>
                        {m.scheduled_at
                          ? new Date(m.scheduled_at).toLocaleString("pt-BR")
                          : "Sem horário"}
                        <br />
                        {m.venue || "Sem local"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Nenhuma partida cadastrada.</p>
        )}
        <p>
          Placares de jogos não finalizados podem ser provisórios ou
          preservados. Jogos cancelados não contam na classificação.
        </p>
      </section>
      <section>
        <h2>Líderes da artilharia</h2>
        {scorers.length ? (
          <ul>
            {scorers.map((r) => (
              <li key={r.player.id}>
                {r.player.name} · {names.get(r.player.team_id)} · {r.goals} gols
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhum gol atribuído a jogadores em partidas finalizadas.</p>
        )}
      </section>
      {includeRosters && (
        <section>
          <h2>Elencos dos times</h2>
          <p>
            Jogadores cadastrados atualmente. Esta lista não representa
            escalação confirmada nem o elenco histórico de cada partida.
          </p>
          {teams.length === 0 && <p>Nenhum time cadastrado.</p>}
          {[...teams]
            .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
            .map((team) => {
              const roster = players
                .filter((p) => p.team_id === team.id)
                .sort(
                  (a, b) =>
                    (a.shirt_number ?? Infinity) -
                      (b.shirt_number ?? Infinity) ||
                    a.name.localeCompare(b.name, "pt-BR"),
                );
              return (
                <section key={team.id} className="report-roster">
                  <h3>
                    {team.name} · {roster.length} jogadores
                  </h3>
                  {roster.length === 0 ? (
                    <p>Nenhum jogador cadastrado.</p>
                  ) : (
                    <div className="report-table">
                      <table aria-label={`Elenco de ${team.name}`}>
                        <thead>
                          <tr>
                            <th scope="col">Camisa</th>
                            <th scope="col">Jogador</th>
                            <th scope="col">Posição</th>
                          </tr>
                        </thead>
                        <tbody>
                          {roster.map((p) => (
                            <tr key={p.id}>
                              <td>{p.shirt_number ?? "—"}</td>
                              <th scope="row">{p.name}</th>
                              <td>{p.position || "Não informada"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              );
            })}
        </section>
      )}
      {championship.regulations && (
        <section>
          <h2>Regulamento</h2>
          <p className="regulations-text">{championship.regulations}</p>
        </section>
      )}
    </section>,
    document.body,
  );
}
