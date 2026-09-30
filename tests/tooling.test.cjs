"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));

function execute(bin, args, input) {
	const result = spawnSync(process.execPath, [path.join(root, bin), ...args], {
		cwd: root,
		encoding: "utf8",
		input,
		shell: false,
		timeout: 60000,
	});
	assert.ifError(result.error);
	return result;
}

function fixture(t, source) {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "rbxts-tooling-"));
	t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
	const file = path.join(directory, "probe.ts");
	fs.writeFileSync(file, source);
	return file;
}

test("roblox-ts and the project use the same pinned TypeScript", () => {
	const project = read("package.json");
	assert.equal(read("node_modules/roblox-ts/package.json").dependencies.typescript, "=5.5.3");
	assert.equal(project.devDependencies.typescript, "5.5.3");
	assert.equal(read("node_modules/typescript/package.json").version, "5.5.3");
});

test("compilation still rejects user-source type errors despite declaration-file compatibility exclusions", () => {
	const ts = require("typescript");
	const config = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile);
	const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
	assert.equal(parsed.options.skipLibCheck, true);
	assert.match(read("package.json").scripts.typecheck, /--skipLibCheck true/);
	assert.match(read("package.json").scripts["check:full"], /npm run typecheck/);
	const file = path.join(root, "src/shared/type-safety-probe.ts").split(path.sep).join("/");
	const options = {
		...parsed.options,
		noEmit: true,
		incremental: false,
		tsBuildInfoFile: undefined,
	};
	const host = ts.createCompilerHost(options);
	const original = host.getSourceFile.bind(host);
	host.getSourceFile = (name, ...args) =>
		name === file
			? ts.createSourceFile(
					name,
					'export const value: number = "not a number";',
					ts.ScriptTarget.Latest,
					true,
				)
			: original(name, ...args);
	const program = ts.createProgram([...parsed.fileNames, file], options, host);
	assert.ok(
		ts
			.getPreEmitDiagnostics(program)
			.some((diagnostic) => diagnostic.file?.fileName === file && diagnostic.code === 2322),
	);
});

test("fast config uses native rules; Roblox config covers every non-type-aware rule", () => {
	const fast = read(".oxlintrc.json");
	assert.equal(fast.jsPlugins, undefined);
	assert.equal(fast.rules["typescript/no-explicit-any"], "error");
	const config = read(".oxlint-roblox.json");
	const plugin = require("eslint-plugin-roblox-ts");
	const names = Object.entries(plugin.rules)
		.filter(([, rule]) => !rule.meta.docs?.requiresTypeChecking)
		.map(([name]) => `roblox-ts/${name}`);
	assert.deepEqual(Object.keys(config.rules).sort(), names.sort());
	assert.ok(config.jsPlugins.includes("eslint-plugin-roblox-ts"));
});

test("native Oxlint rejects explicit any and emits machine-readable diagnostics", (t) => {
	const file = fixture(t, "const value: any = 1; print(value);\n");
	const result = execute("node_modules/oxlint/bin/oxlint", [
		"--config",
		".oxlintrc.json",
		"--format",
		"json",
		file,
	]);
	assert.notEqual(result.status, 0, result.stdout);
	assert.match(result.stdout, /no-explicit-any/);
	assert.ok(JSON.parse(result.stdout).diagnostics.length > 0);
});

test("Roblox-specific Oxlint rules reject null and unsupported for-in", (t) => {
	for (const [source, rule] of [
		["const value: unknown = null; print(value);\n", "no-null"],
		["const value = { a: 1 }; for (const key in value) { print(key); }\n", "no-for-in"],
	]) {
		const file = fixture(t, source);
		const result = execute("node_modules/oxlint/bin/oxlint", [
			"--config",
			".oxlint-roblox.json",
			"--format",
			"json",
			file,
		]);
		assert.notEqual(result.status, 0, result.stdout);
		assert.match(result.stdout, new RegExp(`roblox-ts\\(${rule}\\)|roblox-ts/${rule}`));
	}
});

test("Oxfmt detects unformatted input instead of silently skipping it", (t) => {
	const file = fixture(t, "const example={a:1,b:2};\n");
	const result = execute("node_modules/oxfmt/bin/oxfmt", [
		"--config",
		".oxfmtrc.json",
		"--check",
		file,
	]);
	assert.notEqual(result.status, 0, result.stdout);
	assert.match(result.stdout + result.stderr, /probe\.ts/);
});

test("typed ESLint rejects pairs on a TypeScript array without mutating source", () => {
	const result = execute(
		"node_modules/eslint/bin/eslint.js",
		["--stdin", "--stdin-filename", "src/shared/settings.ts", "--format", "json"],
		"const values = [1, 2]; pairs(values);\n",
	);
	assert.notEqual(result.status, 0, result.stdout + result.stderr);
	const messages = JSON.parse(result.stdout).flatMap((file) => file.messages);
	assert.ok(
		messages.some((message) => message.ruleId === "roblox-ts/no-array-pairs"),
		JSON.stringify(messages),
	);
});

test("each place maps only its own entries and retains the compiler's shared paths", () => {
	const compiler = read("compiler.project.json").tree;
	for (const role of ["lobby", "game"]) {
		const project = read(`places/${role}.project.json`).tree;
		const other = role === "lobby" ? "game" : "lobby";
		const server = project.ServerScriptService.TS;
		const client = project.StarterPlayer.StarterPlayerScripts.TS;
		assert.equal(server[other], undefined);
		assert.equal(client[other], undefined);
		assert.ok(server[role] && client[role]);
		for (const [node, kind] of [
			[server, "server"],
			[client, "client"],
		]) {
			for (const folder of [role, "common"]) {
				assert.equal(
					path.resolve(root, "places", node[folder].$path),
					path.join(root, "out", kind, folder),
				);
			}
		}
		assert.equal(
			path.resolve(root, "places", project.ReplicatedStorage.TS.$path),
			path.resolve(root, compiler.ReplicatedStorage.TS.$path),
		);
		assert.equal(
			path.resolve(root, "places", project.ReplicatedStorage.rbxts_include.$path),
			path.resolve(root, compiler.ReplicatedStorage.rbxts_include.$path),
		);
	}
});
