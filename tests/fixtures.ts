const user = { id: "owner-preview", email: "organizador@example.invalid" };
const championship = {
  id: "cup-preview",
  owner_id: user.id,
  name: "Copa da Comunidade",
  sport: "Futebol",
  format: "Grupos + mata-mata",
  status: "em_andamento",
  max_teams: 8,
  invite_code: "DEMO1234",
  is_public: true,
  public_slug: "preview",
  created_at: "2026-09-02T10:00:00Z",
};
export const db: Record<string, any[]> = {
  profiles: [{ ...user, full_name: "Organizador de teste" }],
  championships: [championship],
  teams: [
    {
      id: "t1",
      championship_id: championship.id,
      name: "Estrela Azul",
      short_name: "AZUL",
      city: "Brasília",
      manager_user_id: null,
    },
    {
      id: "t2",
      championship_id: championship.id,
      name: "União Verde",
      short_name: "UNI",
      city: "Taguatinga",
      manager_user_id: null,
    },
  ],
  players: [
    {
      id: "p1",
      team_id: "t1",
      name: "Jogador de teste",
      shirt_number: 10,
      position: "Meia",
    },
  ],
  matches: [
    {
      id: "m1",
      championship_id: championship.id,
      home_team_id: "t1",
      away_team_id: "t2",
      round: 1,
      status: "finalizado",
      home_score: 2,
      away_score: 1,
      bracket_stage: null,
      penalty_home_score: null,
      penalty_away_score: null,
    },
  ],
  championship_members: [],
  match_events: [],
};
function from(table: string) {
  let filters: ((r: any) => boolean)[] = [],
    single = false,
    operation = "read",
    payload: any;
  const q: any = {
    select() {
      return q;
    },
    order() {
      return q;
    },
    eq(k: string, v: any) {
      filters.push((r) => r[k] === v);
      return q;
    },
    neq(k: string, v: any) {
      filters.push((r) => r[k] !== v);
      return q;
    },
    in(k: string, v: any[]) {
      filters.push((r) => v.includes(r[k]));
      return q;
    },
    range() {
      return q;
    },
    limit() {
      return q;
    },
    maybeSingle() {
      single = true;
      return q;
    },
    single() {
      single = true;
      return q;
    },
    throwOnError() {
      return q;
    },
    update(v: any) {
      operation = "update";
      payload = v;
      return q;
    },
    insert(v: any) {
      operation = "insert";
      payload = v;
      return q;
    },
    delete() {
      operation = "delete";
      return q;
    },
    then(resolve: any) {
      let rows = (db[table] || []).filter((r) => filters.every((f) => f(r)));
      if (operation === "update")
        rows.forEach((r) => Object.assign(r, payload));
      if (operation === "insert") {
        rows = (Array.isArray(payload) ? payload : [payload]).map((r) => ({
          ...r,
          id: crypto.randomUUID(),
        }));
        db[table].push(...rows);
      }
      if (operation === "delete")
        db[table] = db[table].filter((r) => !rows.includes(r));
      resolve({ data: single ? rows[0] || null : rows, error: null });
    },
  };
  return q;
}
export const supabase = {
  from,
  auth: {
    getSession: async () => ({
      data: {
        session: location.search.includes("auth-preview") ? null : { user },
      },
    }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
  },
  rpc: async () => ({ data: null, error: null }),
};
export const publicSupabase = supabase;
export const siteUrl = "http://localhost:5173";
