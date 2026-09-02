// Supabase caps individual responses. Keep ordering stable and fetch every page.
export async function fetchAll<T = Record<string, any>>(
  query: () => any,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await query().range(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 500) return rows;
  }
}
