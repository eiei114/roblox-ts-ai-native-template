"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
fs.mkdirSync(path.join(root, "build"), { recursive: true });
for (const role of ["lobby", "game"]) {
	const result = spawnSync(
		"rojo",
		["build", `places/${role}.project.json`, "-o", `build/${role}.rbxlx`],
		{
			cwd: root,
			stdio: "inherit",
			shell: false,
		},
	);
	if (result.error) {
		console.error(`Rojo 7 must be on PATH: ${result.error.message}`);
		process.exit(1);
	}
	if (result.status !== 0) process.exit(result.status || 1);
}
