// NUSA SKY RUN — main.ts
// One job: hand the game in. Copies game/ and screenshots/ from this
// repository into the output directory (/output on the grader, or
// $MAKEFUN_OUTPUT_DIR outside it) and writes /output/dossier.json with
// buildDossier from vendor/makefun-game.ts. Node 22, standard library only,
// no network, no build step. Running it twice writes the same bytes.

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

for (const name of ['game', 'screenshots']) {
  const target = join(outDir, name);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(join(repoRoot, name), target, { recursive: true });
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`wrote ${outDir}/dossier.json (${dossier.length} bytes)`);
