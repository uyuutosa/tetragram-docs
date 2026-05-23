import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ParsedArgs } from "../lib/args.ts";
import type { Section } from "../lib/types.ts";
import { copyDir, resolveTemplateDir } from "../lib/fs.ts";

const KNOWN_SECTIONS: ReadonlySet<Section> = new Set([
  "arc42",
  "diagrams",
  "detailed-design",
  "design-guide",
  "api-contract",
  "impl-plans",
  "task-list",
  "postmortems",
  "reports",
  "cost-estimates",
  "user-manual",
  "templates",
] as const);

/**
 * `pentaglyph add <section> [--target=<dir>]`
 *
 * Add a single section to an existing scaffolded project.
 */
export async function runAdd(opts: ParsedArgs): Promise<void> {
  const section = opts._[0] as Section | undefined;
  if (!section || !KNOWN_SECTIONS.has(section)) {
    throw new Error(
      `Usage: pentaglyph add <section>\n  Known sections: ${[...KNOWN_SECTIONS].join(", ")}`,
    );
  }

  const target = opts._[1] ?? ".";
  const targetDocs = resolve(target, "docs");
  if (!existsSync(targetDocs)) {
    throw new Error(`No docs/ directory at ${targetDocs}. Run 'pentaglyph init' first.`);
  }

  const templateDocs = join(await resolveTemplateDir(), "docs");
  // Section lookup candidates: layer-prefixed (post-ADR-0010) first, fall
  // back to flat path. Mirrors init.ts logic — see that file's section
  // loop for the same rationale.
  const candidates = [join("01-artefacts", section), section];
  let src = "";
  let rel = "";
  for (const c of candidates) {
    if (existsSync(join(templateDocs, c))) {
      src = join(templateDocs, c);
      rel = c;
      break;
    }
  }
  if (!src) {
    throw new Error(
      `Section "${section}" missing from template ` +
        `(tried 01-artefacts/${section} and ${section})`,
    );
  }
  const dest = join(targetDocs, rel);

  const log = (msg: string) => process.stdout.write(`${msg}\n`);
  log(`pentaglyph add ${section}`);
  log(`  source: ${src}`);
  log(`  dest:   ${dest}`);
  log("");

  const result = await copyDir(src, dest, {
    force: !!opts.force,
    dryRun: !!opts.dryRun,
    log,
    transform: (content) =>
      opts.name ? content.replaceAll("<placeholder>", opts.name) : content,
  });

  log("");
  log(`Done. ${result.copied} files written, ${result.skipped} skipped.`);
}
