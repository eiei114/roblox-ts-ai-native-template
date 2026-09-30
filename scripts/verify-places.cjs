"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");

function descend(node, names) {
	for (const name of names) {
		node = node.children?.find((child) => child.name === name);
		assert.ok(node, `Missing mapped object: ${name}`);
	}
	return node;
}

for (const role of ["lobby", "game"]) {
	const result = spawnSync(
		"rojo",
		["sourcemap", `places/${role}.project.json`, "--include-non-scripts"],
		{
			cwd: root,
			encoding: "utf8",
			shell: false,
			timeout: 30000,
		},
	);
	assert.ifError(result.error);
	assert.equal(result.status, 0, result.stderr);
	const tree = JSON.parse(result.stdout);
	const server = descend(tree, ["ServerScriptService", "TS"]);
	const client = descend(tree, ["StarterPlayer", "StarterPlayerScripts", "TS"]);
	for (const node of [server, client]) {
		assert.deepEqual(node.children.map((child) => child.name).sort(), ["common", role].sort());
	}
	assert.equal(descend(server, [role, "main"]).className, "Script");
	assert.equal(descend(client, [role, "main"]).className, "LocalScript");
	assert.equal(descend(server, ["common", "register-players"]).className, "ModuleScript");
	assert.equal(descend(client, ["common", "announce-client"]).className, "ModuleScript");
	assert.equal(descend(tree, ["ReplicatedStorage", "TS", "settings"]).className, "ModuleScript");
	assert.ok(fs.statSync(path.join(root, "build", `${role}.rbxlx`)).size > 0);
	console.log(`${role}: separate entries, shared paths and place artifact verified`);
}
