import type { calculateStandings } from "./lib/competition";
import "./standings-table.css";

type Row = ReturnType<typeof calculateStandings>[number];
const labels = { V: "Vitória", E: "Empate", D: "Derrota" };
const columns = [
  ["#", "Posição"],
  ["Time", "Time"],
  ["PTS", "Pontos"],
  ["J", "Jogos"],
  ["V", "Vitórias"],
  ["E", "Empates"],
  ["D", "Derrotas"],
  ["GP", "Gols pró"],
  ["GC", "Gols contra"],
  ["SG", "Saldo de gols"],
  ["%", "Aproveitamento"],
  ["Sequência", "Últimos cinco resultados por rodada"],
];

export default function StandingsTable({ rows }: { rows: Row[] }) {
  if (!rows.length) return <p className="muted">Nenhum time cadastrado.</p>;
  return (
    <div className="standings-details">
      <div
        className="standings-scroll"
        role="region"
        aria-label="Tabela de classificação"
        tabIndex={0}
      >
        <table>
          <caption>Classificação da fase de pontos</caption>
          <thead>
            <tr>
              {columns.map(([short, full]) => (
                <th key={short} scope="col" title={full} aria-label={full}>
                  {short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.team.id}>
                <td>{index + 1}</td>
                <th scope="row">{row.team.name}</th>
                <td>
                  <b>{row.points}</b>
                </td>
                <td>{row.played}</td>
                <td>{row.wins}</td>
                <td>{row.draws}</td>
                <td>{row.losses}</td>
                <td>{row.goalsFor}</td>
                <td>{row.goalsAgainst}</td>
                <td>{row.goalDiff}</td>
                <td>
                  {row.percentage === null
                    ? "—"
                    : `${row.percentage.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
                </td>
                <td>
                  {row.form.length ? (
                    <span className="standing-form">
                      {row.form.map((game, i) => {
                        const description = `${labels[game.result]}: ${game.score} contra ${game.opponent}${game.round == null ? "" : ` · Rodada ${game.round}`}`;
                        return (
                          <span
                            key={i}
                            className={`form-result form-${game.result}`}
                            title={description}
                            aria-label={description}
                          >
                            {game.result}
                          </span>
                        );
                      })}
                    </span>
                  ) : (
                    <span aria-label="Sem jogos finalizados">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="standings-note">
        Sequência: até cinco jogos finalizados em ordem de rodada, da menor para
        a maior. V = vitória, E = empate, D = derrota.
      </p>
      <details>
        <summary>Como a classificação é calculada?</summary>
        <p>
          Vitória vale 3 pontos, empate vale 1 e derrota vale 0. Apenas partidas
          finalizadas da fase de pontos entram na tabela; o mata-mata não altera
          esta classificação.
        </p>
        <p>
          Ordem: pontos, vitórias, saldo de gols e gols pró. Persistindo a
          igualdade, os times aparecem em ordem alfabética.
        </p>
        <p>
          Aproveitamento (%) = pontos conquistados ÷ pontos possíveis nos jogos
          disputados. Times sem jogos finalizados mostram um traço.
        </p>
        <p>
          J = jogos; GP = gols pró; GC = gols contra; SG = saldo de gols. Jogos
          da mesma rodada são ordenados pelo identificador da partida.
        </p>
      </details>
    </div>
  );
}
