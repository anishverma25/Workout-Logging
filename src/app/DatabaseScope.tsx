import { Fragment, useSyncExternalStore, type ReactNode } from 'react';
import { db, onDatabaseSwitch } from '@/data/db';

/**
 * Remounts the app when the open database changes (sign in, sign out), so every live query
 * subscribes to the new one and no screen can show the previous account's data.
 */
export function DatabaseScope({ children }: { children: ReactNode }) {
  const name = useSyncExternalStore(onDatabaseSwitch, () => db.name);
  return <Fragment key={name}>{children}</Fragment>;
}
