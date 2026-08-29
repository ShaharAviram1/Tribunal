// Fixture loaders for the protocol suite. Every document instance is read from disk,
// never copied inline, so the tests and the specification documents cannot drift apart.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd(), 'fixtures');

export const fixturePath = (...parts: string[]): string => join(root, ...parts);

export const readText = (...parts: string[]): string => readFileSync(fixturePath(...parts), 'utf8');

export const readJson = <T = unknown>(...parts: string[]): T => JSON.parse(readText(...parts)) as T;

export const listDir = (...parts: string[]): string[] => readdirSync(fixturePath(...parts)).sort();

// Deep copy so a test can mutate a fixture into a constructed variant without touching the cache.
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

// Whitespace-separated tokens, the counting rule every document states.
export const words = (n: number, word = 'word'): string => Array.from({ length: n }, () => word).join(' ');

// The four advocate role ids and their seats, from docs/advocate-stance.schema.md section 2.
export const ADVOCATE_SEATS: ReadonlyArray<readonly [string, 'defense' | 'prosecution']> = [
  ['jon', 'defense'],
  ['tyrion', 'defense'],
  ['daenerys', 'prosecution'],
  ['greyworm', 'prosecution'],
];
export const ADVOCATE_IDS: readonly string[] = ADVOCATE_SEATS.map(([id]) => id);

// The three judge role ids, from docs/judicial-opinion.schema.md section 2.
export const JUDGE_IDS: readonly string[] = ['judge-1', 'judge-2', 'judge-3'];

// Point ids for a stance of `count` points: `<role_id>.p<n>` from 1, section 2 of the stance schema.
export const pointIds = (role_id: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) => `${role_id}.p${i + 1}`);
