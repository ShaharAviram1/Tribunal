// Assembles one call's prompt from parts, in the order fixed by prompts/_contract.md.
// Reads the role files and the judge preamble from disk at call time: prompts are files, not strings.
// Deterministic; no model call; no network.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { renderChargeSheetBlock, type StoredChargeSheet } from './render-charge-sheet.ts';

export const ADVOCATES = ['jon', 'tyrion', 'daenerys', 'greyworm'] as const;
export const JUDGES = ['judge-1', 'judge-2', 'judge-3'] as const;
export type RoleId = (typeof ADVOCATES)[number] | (typeof JUDGES)[number];

export type SketchPersona = { name: string; seat: 'defense' | 'prosecution'; sketch: string };

// Intake cases carry four representative sketches; the two defense sketches fill the jon and
// tyrion seats in order, the two prosecution sketches the daenerys and greyworm seats. The
// hand-written frame prompts/_advocate-frame.md carries the standing argument rules; the sketch
// carries the character. T-001 keeps its dossier prompts untouched.
export function personaForRole(role: string, sketches: SketchPersona[] | undefined): SketchPersona | null {
  if (!sketches || sketches.length !== 4) return null;
  const bySeat = (seat: string) => sketches.filter((x) => x.seat === seat);
  const map: Record<string, SketchPersona | undefined> = {
    jon: bySeat('defense')[0], tyrion: bySeat('defense')[1],
    daenerys: bySeat('prosecution')[0], greyworm: bySeat('prosecution')[1],
  };
  return map[role] ?? null;
}

export type AssembledPrompt = {
  role_id: RoleId;
  blocks: string[];
  text: string;
  hash: string;
};

const SEP = '\n\n';
const HEADER = /^<!--[\s\S]*?-->\n?/;

function stripHeader(s: string): string {
  return s.replace(HEADER, '');
}

function readPromptFile(promptsDir: string, name: string): string {
  return stripHeader(readFileSync(join(promptsDir, `${name}.md`), 'utf8')).trim();
}

function outputContract(kind: 'advocate' | 'judge', contract: string): string {
  const heading = kind === 'advocate' ? '## Output contract, advocates' : '## Output contract, judges';
  const start = contract.indexOf(heading);
  if (start < 0) throw new Error(`contract missing section: ${heading}`);
  const rest = contract.slice(start + heading.length);
  const end = rest.indexOf('\n## ');
  return (end < 0 ? rest : rest.slice(0, end)).trim();
}

export function assemblePrompt(opts: {
  role_id: RoleId;
  chargeSheet: StoredChargeSheet;
  stances?: unknown[];
  corrective?: string;
  promptsDir?: string;
  sketches?: SketchPersona[];
}): AssembledPrompt {
  const promptsDir = opts.promptsDir ?? join(process.cwd(), 'prompts');
  const isJudge = (JUDGES as readonly string[]).includes(opts.role_id);
  const contract = readFileSync(join(promptsDir, '_contract.md'), 'utf8');

  const blocks: string[] = [];
  blocks.push(renderChargeSheetBlock(opts.chargeSheet));
  if (isJudge) blocks.push(readPromptFile(promptsDir, '_judge-preamble'));
  const persona = isJudge ? null : personaForRole(opts.role_id, opts.sketches);
  if (persona) {
    const frame = readPromptFile(promptsDir, '_advocate-frame');
    blocks.push(frame.replaceAll('{{name}}', persona.name).replaceAll('{{seat}}', persona.seat).replaceAll('{{sketch}}', persona.sketch));
  } else {
    blocks.push(readPromptFile(promptsDir, opts.role_id));
  }
  if (isJudge) {
    if (!opts.stances || opts.stances.length !== 4) throw new Error('a judge prompt requires exactly four stances');
    blocks.push(['Advocate stances', ...opts.stances.map((s) => JSON.stringify(s, null, 2))].join('\n\n'));
  }
  blocks.push(outputContract(isJudge ? 'judge' : 'advocate', contract));
  if (opts.corrective) blocks.push(opts.corrective);

  const text = blocks.join(SEP);
  const hash = createHash('sha256').update(text, 'utf8').digest('hex');
  return { role_id: opts.role_id, blocks, text, hash };
}
