export default {
	extends: ["@commitlint/config-conventional"],
	rules: {
		// types: feat, fix, chore, docs, style, refactor, perf, test, build, ci, revert
		"type-enum": [
			2,
			"always",
			[
				"feat",
				"fix",
				"chore",
				"docs",
				"style",
				"refactor",
				"perf",
				"test",
				"build",
				"ci",
				"revert",
			],
		],
		"subject-case": [0], // don't enforce case
		"body-max-line-length": [0], // no line length limit on body
	},
};
