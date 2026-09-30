"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { performance } = require("node:perf_hooks");
const root = path.resolve(__dirname, "..");
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Use npm run benchmark:tooling so the npm CLI path is known.");

const rows = [];
for (const command of ["lint", "lint:roblox", "check"]) {
	const samples = [];
	for (let run = 0; run < 4; run++) {
		const start = performance.now();
		const result = spawnSync(process.execPath, [npm, "run", "--silent", command], {
			cwd: root,
			encoding: "utf8",
			shell: false,
			timeout: 120000,
		});
		const seconds = (performance.now() - start) / 1000;
		if (result.error || result.status !== 0) {
			throw new Error(
				`${command} failed: ${result.error?.message || result.stderr || result.stdout}`,
			);
		}
		if (run > 0) samples.push(seconds);
	}
	const sorted = [...samples].sort((a, b) => a - b);
	rows.push({ command, seconds: samples, median_seconds: sorted[1] });
}
const report = {
	node: process.version,
	platform: process.platform,
	arch: process.arch,
	warmup_runs: 1,
	measured_runs: 3,
	scope: "development tools only, not AI generation",
	rows,
};
fs.mkdirSync(path.join(root, "build"), { recursive: true });
fs.writeFileSync(
	path.join(root, "build/tooling-benchmark.json"),
	JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
