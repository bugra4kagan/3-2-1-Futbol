import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CompactRosterPayload,
  RosterHydrationStatus,
  getRosterHydrationStatus,
  hydrateCompactRoster,
} from './rosterLoader.js';

let nodeAttempted = false;

function findRosterJsonPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'public', 'data', 'roster25k.v2.json'),
    path.resolve(process.cwd(), 'dist', 'data', 'roster25k.v2.json'),
  ];
  try {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    candidates.push(
      path.resolve(dir, '../../public/data/roster25k.v2.json'),
      path.resolve(dir, '../../../public/data/roster25k.v2.json')
    );
  } catch {
    // ignore URL resolution failure
  }
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function ensureExpandedRosterSync(): RosterHydrationStatus {
  const current = getRosterHydrationStatus();
  if (current.hydrated || nodeAttempted) {
    return current;
  }
  nodeAttempted = true;
  const jsonPath = findRosterJsonPath();
  if (!jsonPath) {
    console.warn('[RosterNodeLoader] public/data/roster25k.v2.json not found; using embedded base roster.');
    return getRosterHydrationStatus();
  }
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const parsed = JSON.parse(raw) as CompactRosterPayload;
  return hydrateCompactRoster(parsed);
}
