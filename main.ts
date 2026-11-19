// Token Launch Radar — entrypoint (stage 1). Node 22+, standard library only, no network.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBoard, type Snapshot } from "./lib/model.ts";
import { buildDossier } from "./vendor/makefun-board.ts";

const root = dirname(fileURLToPath(import.meta.url));

function inputPath(): string {
  const envDir = process.env.MAKEFUN_INPUT_DIR;
  const candidates = [
    ...(envDir ? [join(envDir, "snapshot.json")] : []),
    "/input/snapshot.json",
    join(root, "input", "snapshot.json"),
    join(root, "..", "token-radar-01-kit", "input", "snapshot.json"),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  throw new Error("snapshot.json not found in any known input location");
}

function outputDir(): string {
  if (process.env.MAKEFUN_OUTPUT_DIR) return process.env.MAKEFUN_OUTPUT_DIR;
  if (existsSync("/input/snapshot.json")) return "/output";
  return join(root, "output");
}

function copyDir(src: string, dst: string): void {
  mkdirSync(dst, { recursive: true });
  for (const e of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, e.name), d = join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else if (e.isFile()) copyFileSync(s, d);
  }
}

function main(): void {
  const snap = JSON.parse(readFileSync(inputPath(), "utf8")) as Snapshot;
  const board = buildBoard(snap, 240);
  const out = outputDir();
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "board.json"), JSON.stringify(board, null, 2) + "\n");

  const dashSrc = join(root, "dashboard");
  const dashDst = join(out, "dashboard");
  copyDir(dashSrc, dashDst);
  // Slim dashboard data (stage 2): compact tuples, not full board objects.
  // Full rows live in board.json; the dashboard only needs the fields below,
  // and app.js rebuilds why/farm_steps/token_status from the same templates
  // as lib/model.ts. This keeps the whole output dashboard ~35 KB, so the
  // dossier text (capped at 65,536 bytes) can hold every dashboard file
  // whole instead of cutting data.js and dropping index.html.
  // Tuple: [slug, name, category, chains, tvl_usd, change_7d,
  //         implied_value_usd, token_recorded?1:0, watchlist?1:0, age_days]
  const tuples = board.map((r) => [
    r.slug, r.name, r.category, r.chains, r.tvl_usd, r.change_7d,
    r.implied_value_usd, r.token_recorded ? 1 : 0, r.watchlist ? 1 : 0, r.age_days,
  ]);
  writeFileSync(join(dashDst, "data.js"), "window.BOARD_DATA=" + JSON.stringify(tuples) + ";\n");

  const shotsSrc = join(root, "screenshots");
  if (existsSync(shotsSrc) && readdirSync(shotsSrc).length > 0) {
    copyDir(shotsSrc, join(out, "screenshots"));
    try {
      const dossier = buildDossier(out, {
        text_max_bytes: 65536,
        screenshots: { max: 4, max_bytes: 512 * 1024 },
        dashboard: { max_files: 400, max_bytes: 4 * 1024 * 1024 },
      });
      writeFileSync(join(out, "dossier.json"), dossier);
    } catch (err) {
      console.error("dossier skipped:", (err as Error).message);
    }
  } else {
    console.error("dossier skipped: screenshots/ is empty (TODO stage)");
  }
  const watchCount = board.filter((r) => r.watchlist).length;
  const dataBytes = statSync(join(dashDst, "data.js")).size;
  console.log(`board rows=${board.length} watchlist=${watchCount} top=${board[0]?.slug ?? "none"} data.js=${dataBytes}B out=${out}`);
}

main();
