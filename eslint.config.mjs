import parser from "@typescript-eslint/parser";
import roblox from "eslint-plugin-roblox-ts";

// Keep only checks requiring TypeScript information here. Oxlint handles the rest.
const typedRules = Object.fromEntries(
	Object.entries(roblox.rules)
		.filter(([, rule]) => rule.meta.docs?.requiresTypeChecking === true)
		.map(([name]) => [`roblox-ts/${name}`, "error"]),
);

export default [
	{ ignores: ["node_modules/**", "out/**", "include/**"] },
	{
		files: ["src/**/*.ts"],
		languageOptions: {
			parser,
			parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
		},
		plugins: { "roblox-ts": roblox },
		rules: typedRules,
	},
];
