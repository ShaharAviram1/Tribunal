// Loaded before every test file. The suite runs on the pinned Node, with no key, and reaches no network.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Match major.minor and let the patch float: a patch difference is not the failure this guards against.
const pinned = readFileSync(join(process.cwd(), '.nvmrc'), 'utf8').trim();
const majorMinor = (v: string) => v.replace(/^v/, '').split('.').slice(0, 2).join('.');
if (majorMinor(process.version) !== majorMinor(pinned)) {
  throw new Error(`offline suite: running on Node ${process.version}, pinned version is ${pinned} (.nvmrc)`);
}
if (process.env.OPENROUTER_API_KEY) {
  throw new Error('offline suite: OPENROUTER_API_KEY must not be set');
}
const blocked = (name: string) => () => {
  throw new Error(`offline suite: ${name} reached the network`);
};
globalThis.fetch = blocked('fetch') as unknown as typeof fetch;
