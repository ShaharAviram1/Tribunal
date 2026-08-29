// Loaded before every test file. The suite runs on the pinned Node, with no key, and reaches no network.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const pinned = readFileSync(join(process.cwd(), '.nvmrc'), 'utf8').trim();
if (process.version !== `v${pinned}`) {
  throw new Error(`offline suite: running on Node ${process.version}, pinned version is ${pinned} (.nvmrc)`);
}
if (process.env.OPENROUTER_API_KEY) {
  throw new Error('offline suite: OPENROUTER_API_KEY must not be set');
}
const blocked = (name: string) => () => {
  throw new Error(`offline suite: ${name} reached the network`);
};
globalThis.fetch = blocked('fetch') as unknown as typeof fetch;
