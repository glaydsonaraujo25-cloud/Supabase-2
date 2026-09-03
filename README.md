# Bracketly

Gestor de campeonatos com React, TypeScript, Vite e Supabase. Cada usuário pode organizar campeonatos ou participar por código de convite.

## Funcionalidades

- Cadastro, login, confirmação de e-mail, reenvio e recuperação de senha.
- Criação e edição de campeonatos, times e jogadores.
- Responsáveis por time e gerenciamento de participantes pelo organizador.
- Tabela de pontos corridos, resultados, classificação e estatísticas individuais.
- Mata-mata com pênaltis e avanço automático em uma transação no banco.
- Página pública opcional com resultados, classificação e estatísticas.
- Ferramentas no menu, mantendo o campeonato selecionado.
- Consultas paginadas por campeonato, navegação por rodadas e acesso pelo celular.

## Desenvolvimento

Use Node.js 22 ou superior:

```bash
npm ci
cp .env.example .env
npm run dev
```

Configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SITE_URL` (a URL definitiva do site, sem barra final). Somente a chave pública deve estar no frontend.

No Supabase Auth, configure a Site URL e permita os redirecionamentos:

- `https://SEU-DOMINIO/?confirmed=1`
- `https://SEU-DOMINIO/?reset=1`

O cadastro segue o comportamento de privacidade do Supabase: a API pode ocultar a existência de uma conta. A interface orienta entrar ou recuperar senha quando a resposta indica cadastro existente, sem prometer que a API sempre revelará essa condição.

## Banco de dados

### Projeto Supabase novo e vazio

Execute no SQL Editor, nesta ordem:

1. `supabase/schema.sql`: estrutura completa, sem dados de usuários, incluindo tabelas legadas necessárias à compatibilidade.
2. `supabase/upgrades/championship_integrity.sql`: permissões e regras atuais do Bracketly.

O snapshot foi reconstruído do banco conectado e testado em uma instância PostgreSQL local. Não execute `schema.sql` sobre um banco já existente.

### Projeto Bracketly que já possui campeonatos

Execute somente `supabase/upgrades/championship_integrity.sql`. O script é transacional e pode ser reaplicado. Ele não exclui campeonatos, times, partidas ou usuários. Essa atualização foi aplicada ao projeto Supabase-2 durante a entrega.

Os arquivos antigos em `supabase/migrations/` pertencem ao sistema de escalas anterior; não os reaplique após instalar o snapshot. Nenhuma tabela legada é apagada nesta atualização.

## Regras da competição

- Pontos corridos: 3 pontos por vitória, 1 por empate. Desempate por vitórias, saldo, gols marcados e nome.
- Apenas partidas finalizadas sem `bracket_stage` entram na classificação por pontos.
- A geração automática não acrescenta uma segunda tabela quando já há jogos.
- Mata-mata: 2, 4, 8, 16, 32 ou 64 times; empate exige pênaltis. Ao concluir todos os jogos de uma fase, o banco gera a seguinte.
- Depois de criada uma fase seguinte, alterações nos jogos anteriores ficam bloqueadas. Para corrigir a chave, use **Refazer chave**, que pede confirmação e apaga somente as eliminatórias e seus resultados.
- `Grupos + mata-mata` mantém a fase classificatória única existente. A chave usa até 16 classificados e só pode começar após finalizar os jogos dessa fase. Divisão em vários grupos independentes ainda não é implementada.
- Times com partidas não podem ser excluídos isoladamente. Remover um participante desassocia seu time na mesma transação.
- Códigos de convite e identificadores de responsáveis não são liberados ao visitante da página pública.

## Validação

```bash
npm test
npm run test:db
npm run build
```

`npm test` valida componentes com dados simulados e regras de classificação. `test:db` cria um PostgreSQL local com PGlite, instala o snapshot e o upgrade e testa permissões, limites, avanço eliminatório e remoção de participantes. Não usa credenciais de produção.

`supabase/tests/championship_integrity.sql` também pode ser executado no SQL Editor: cria registros de teste temporários e termina com `ROLLBACK`. Foi validado no Supabase conectado.

O GitHub Actions executa os testes e a compilação em cada push/PR. A revisão visual no navegador não foi concluída na sessão de entrega porque o navegador bloqueou o endereço da prévia local.

## Estrutura

- `src/ChampionshipDashboard.tsx`: navegação, campeonatos, times, jogadores e partidas.
- `src/AuthScreen.tsx`: acesso e cadastro.
- `src/ParticipantAdminCenter.tsx`, `SharingCenter.tsx`, `StatisticsCenter.tsx`, `KnockoutCenter.tsx`: ferramentas do campeonato.
- `src/PublicChampionship.tsx`: página pública com cliente sem sessão persistida.
- `src/lib/competition.ts`: regras de classificação compartilhadas.
- `src/lib/data.ts`: leitura paginada sem truncar resultados da API.

A proteção de senhas vazadas é uma configuração separada do Supabase Auth e não é ativada pelo código do site. Consulte a [documentação do Supabase](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Gestão de partidas

Na aba **Partidas**, use **Gerenciar partida** para mudar data, horário e status de jogos da fase classificatória. A data usa o fuso horário do dispositivo e é armazenada em UTC. Ao cancelar ou reabrir um resultado finalizado, o placar fica preservado, mas deixa de contar na classificação até nova finalização. Partidas canceladas precisam ser reabertas antes de lançar um resultado.

Os filtros por time e status estão disponíveis na aba Partidas e na página pública. Eles alteram somente a lista de jogos, sem afetar o cálculo da classificação. Jogos de fases anteriores continuam protegidos quando já existe uma eliminatória dependente. O mata-mata mantém sua central específica para resultados.

## Agenda e calendário

A visão geral e a página pública mostram próximas partidas, jogos em andamento e partidas que aguardam horário ou atualização. O filtro por time também seleciona os jogos do arquivo **Baixar agenda (.ics)**. A lista mostra cinco jogos por vez, mas a exportação inclui todos os confrontos futuros agendados da seleção, inclusive eliminatórias.

O arquivo usa UTC para preservar o horário ao importar em outro fuso. Não inventa duração das partidas e não inclui jogos cancelados, finalizados, passados ou sem horário. A importação é manual e não estabelece sincronização: confirme alterações no Bracketly e atualize seu calendário. Formato baseado no [padrão iCalendar (RFC 5545)](https://www.rfc-editor.org/rfc/rfc5545).
