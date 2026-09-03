import type {
  DetailMatch,
  DetailPlayer,
  DetailEvent,
  DetailTeam,
} from "./MatchDetails";
import { championshipResult, topScorers } from "./lib/results";
import "./championship-results.css";
export type ResultsProps = {
  championship: { id: string; name: string; format: string; status: string };
  teams: DetailTeam[];
  matches: DetailMatch[];
  players: DetailPlayer[];
  events: DetailEvent[];
  loading?: boolean;
  error?: string;
  retry?: () => void;
};
export default function ChampionshipResults({
  championship,
  teams,
  matches,
  players,
  events,
  loading,
  error,
  retry,
}: ResultsProps) {
  if (championship.status !== "finalizado") return null;
  const result = championshipResult(championship.format, teams, matches),
    scorers = topScorers(players, events, matches);
  return (
    <section className="championship-results" aria-label="Resumo do campeonato">
      <p className="eyebrow">CAMPEONATO ENCERRADO</p>
      <h2>{championship.name}</h2>
      {!result.champion ? (
        <p role="status">
          {result.message} Revise os registros antes de divulgar o campeão.
        </p>
      ) : (
        <>
          <div className="result-podium">
            <article>
              <span>Campeão</span>
              <h3>{result.champion.name}</h3>
            </article>
            <article>
              <span>Vice-campeão</span>
              <h3>{result.runnerUp!.name}</h3>
            </article>
          </div>
          <p>{result.message}</p>
          <h3>Artilharia</h3>
          {loading ? (
            <p role="status">Carregando artilharia…</p>
          ) : error ? (
            <div role="alert">
              <p>{error}</p>
              <button className="btn secondary" onClick={retry}>
                Tentar novamente
              </button>
            </div>
          ) : scorers.length ? (
            <ul>
              {scorers.map(({ player, goals }) => (
                <li key={player.id}>
                  <strong>{player.name}</strong> ·{" "}
                  {teams.find((t) => t.id === player.team_id)?.name || "Time"} ·{" "}
                  {goals} {goals === 1 ? "gol" : "gols"}
                </li>
              ))}
            </ul>
          ) : (
            <p>Nenhum gol atribuído a jogadores em partidas finalizadas.</p>
          )}
          <p className="muted">
            Artilharia baseada nos gols registrados em Estatísticas. Em caso de
            empate, todos os líderes aparecem. O resumo acompanha as correções
            nos resultados.
          </p>
        </>
      )}
    </section>
  );
}
