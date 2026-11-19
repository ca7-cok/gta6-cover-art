// Neon Coast Cover Studio — entrypoint.
//
// Hands the app in to the grader: copies app/ and screenshots/ from this
// repository into the output directory and writes /output/dossier.json with
// buildDossier from vendor/makefun-app.ts. Node 22, standard library only.
//
// Usage:
//   MAKEFUN_OUTPUT_DIR=out node main.ts     # local run, writes ./out
//   node main.ts                            # grader run, writes /output
//
// The output directory is emptied first, so two runs write the same bytes.

import { buildDossier, DossierError } from './vendor/makefun-app.ts';
import {
  copyFileSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The caps the bounty's gate hands buildDossier (gate.json's keys). */
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
} as const;

/** The most bytes one screenshot may be (the gate's screenshots.max_bytes). */
const SHOT_MAX_BYTES = 262144;
/** How many screenshots the entry hands in: at least 3, at most 4. */
const SHOT_MIN_COUNT = 3;
const SHOT_MAX_COUNT = 4;
/** The image extensions screenshots/ may hold. */
const SHOT_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);

/** A fatal problem: printed as `main.ts: <message>` and the process exits 1. */
class EntryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EntryError';
  }
}

/** The repository root: the directory this file lives in. */
function repoRoot(): string {
  return dirname(fileURLToPath(import.meta.url));
}

/** The output directory: MAKEFUN_OUTPUT_DIR outside the grader, /output inside it. */
function outputDir(): string {
  const env = (process.env.MAKEFUN_OUTPUT_DIR ?? '').trim();
  return resolve(env === '' ? '/output' : env);
}

/** Whether `path` is a directory. */
function isDirectory(path: string): boolean {
  try {
    return lstatSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** Whether `path` is a plain file. */
function isFile(path: string): boolean {
  try {
    return lstatSync(path).isFile();
  } catch {
    return false;
  }
}

/** The entry's inputs, checked before anything is copied. */
function checkInputs(root: string): { appDir: string; shotsDir: string; shots: string[] } {
  const appDir = join(root, 'app');
  const shotsDir = join(root, 'screenshots');
  if (!isDirectory(appDir)) throw new EntryError(`app/: no such directory in ${root}`);
  if (!isFile(join(appDir, 'index.html'))) {
    throw new EntryError('app/index.html: no such file: the app needs its page');
  }
  if (!isDirectory(shotsDir)) throw new EntryError(`screenshots/: no such directory in ${root}`);
  const shots = readdirSync(shotsDir)
    .filter((name) => !name.startsWith('.'))
    .sort();
  if (shots.length < SHOT_MIN_COUNT || shots.length > SHOT_MAX_COUNT) {
    throw new EntryError(
      `screenshots/: holds ${shots.length} images, need ${SHOT_MIN_COUNT} to ${SHOT_MAX_COUNT}`,
    );
  }
  for (const name of shots) {
    const path = join(shotsDir, name);
    if (!isFile(path)) throw new EntryError(`screenshots/${name}: not a plain file`);
    const lower = name.toLowerCase();
    const dot = lower.lastIndexOf('.');
    if (dot < 0 || !SHOT_EXTENSIONS.has(lower.slice(dot))) {
      throw new EntryError(`screenshots/${name}: not a PNG or JPEG image`);
    }
    const bytes = statSync(path).size;
    if (bytes > SHOT_MAX_BYTES) {
      throw new EntryError(`screenshots/${name}: ${bytes} bytes, over the ${SHOT_MAX_BYTES} allowed`);
    }
  }
  return { appDir, shotsDir, shots };
}

/** Copies one tree into another, entries in sorted order so the copy is stable. */
function copyTree(from: string, to: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from).sort()) {
    const src = join(from, name);
    const dst = join(to, name);
    if (isDirectory(src)) {
      const sub = copyTree(src, dst);
      files += sub.files;
      bytes += sub.bytes;
    } else if (isFile(src)) {
      copyFileSync(src, dst);
      files++;
      bytes += statSync(src).size;
    } else {
      throw new EntryError(`${src}: a symbolic link or special file, not copied`);
    }
  }
  return { files, bytes };
}

/** Empties the output directory, refusing to touch the repository or the filesystem root. */
function prepareOutput(out: string, root: string): void {
  if (out === '/' || out === root || root.startsWith(`${out}/`)) {
    throw new EntryError(`refusing to empty the output directory ${out}`);
  }
  // The grader mounts /output as a writable directory on a read-only
  // filesystem and runs the entry as user 65534: that user may write
  // inside /output, but removing /output itself needs write permission on
  // its parent, which the read-only filesystem does not grant — so the
  // previous rmSync(out, { recursive: true }) died with EACCES there.
  // Empty the directory's contents and leave the directory standing.
  let exists = false;
  try {
    lstatSync(out);
    exists = true;
  } catch {
    exists = false;
  }
  if (!exists) {
    mkdirSync(out, { recursive: true });
    return;
  }
  if (!isDirectory(out)) {
    // A stray file where the directory should be: remove it, then make the directory.
    rmSync(out, { force: true });
    mkdirSync(out, { recursive: true });
    return;
  }
  for (const name of readdirSync(out).sort()) {
    rmSync(join(out, name), { recursive: true, force: true });
  }
}

function main(): void {
  const root = repoRoot();
  const out = outputDir();
  const { appDir, shotsDir, shots } = checkInputs(root);
  prepareOutput(out, root);

  const appCopied = copyTree(appDir, join(out, 'app'));
  const shotsCopied = copyTree(shotsDir, join(out, 'screenshots'));

  let dossier: Uint8Array;
  try {
    dossier = buildDossier(out, DOSSIER_CAPS);
  } catch (err) {
    if (err instanceof DossierError) {
      throw new EntryError(
        `dossier: ${err.message}${err.limit === null ? '' : ` (limit: ${err.limit})`}`,
      );
    }
    throw err;
  }
  writeFileSync(join(out, 'dossier.json'), dossier);

  // The grader runs the entry twice and requires the same bytes both times:
  // rebuild the dossier from what was just written and refuse to hand in a
  // result that does not reproduce itself.
  const rebuilt = buildDossier(out, DOSSIER_CAPS);
  if (!Buffer.from(dossier).equals(Buffer.from(rebuilt))) {
    throw new EntryError('dossier: a second build from /output differs, not deterministic');
  }

  console.log(`Neon Coast Cover Studio: wrote ${out}`);
  console.log(
    `  app/: ${appCopied.files} files (${appCopied.bytes} bytes), ` +
      `screenshots/: ${shotsCopied.files} files (${shotsCopied.bytes} bytes)`,
  );
  console.log(
    `  dossier.json: ${dossier.length} bytes, ` +
      `cover ${shots[0] ?? '(none)'}, ${shots.length} screenshots`,
  );
}

try {
  main();
} catch (err) {
  if (err instanceof EntryError || err instanceof DossierError) {
    console.error(`main.ts: ${err.message}`);
  } else {
    console.error(`main.ts: ${(err as Error).message}`);
  }
  process.exit(1);
}
