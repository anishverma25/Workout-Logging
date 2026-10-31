/**
 * Supersets are exercises next to each other that share a group number. Linking an exercise to
 * the one after it joins their groups; unlinking splits the group at that point. A group of one
 * is not a superset, so its number is cleared.
 */
export interface Groupable {
  id: string;
  supersetGroup?: number | null;
}

export type GroupChange = { id: string; changes: { supersetGroup: number | null } };

export function toggleSupersetChanges(items: Groupable[], index: number): GroupChange[] {
  const current = items[index];
  const next = items[index + 1];
  if (!current || !next) return [];
  const group = current.supersetGroup ?? null;
  const fresh = () => Math.max(0, ...items.map((e) => e.supersetGroup ?? 0)) + 1;
  if (group !== null && next.supersetGroup === group) {
    const before = items.slice(0, index + 1).filter((e) => e.supersetGroup === group);
    const after = items.slice(index + 1).filter((e) => e.supersetGroup === group);
    const newGroup = fresh();
    return [
      ...(before.length < 2
        ? before.map((e) => ({ id: e.id, changes: { supersetGroup: null } }))
        : []),
      ...after.map((e) => ({
        id: e.id,
        changes: { supersetGroup: after.length < 2 ? null : newGroup },
      })),
    ];
  }
  const target = group ?? next.supersetGroup ?? fresh();
  const joining = new Set([current.id, next.id]);
  if (next.supersetGroup != null)
    items.filter((e) => e.supersetGroup === next.supersetGroup).forEach((e) => joining.add(e.id));
  return [...joining].map((id) => ({ id, changes: { supersetGroup: target } }));
}
