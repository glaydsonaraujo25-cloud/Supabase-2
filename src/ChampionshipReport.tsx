import { createPortal } from "react-dom";
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
        <p>
          Na janela de impressão, escolha Salvar como PDF. O relatório inclui
          todos os jogos, sem os filtros da tela.
        </p>
      </div>
      <header>
        <h1>{championship.name}</h1>
        <p>
          {championship.sport} · {championship.format} · {championship.status}
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
