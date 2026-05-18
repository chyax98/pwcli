import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import {
	managedHarClean,
	managedHarFilter,
	managedHarReplay,
	managedHarReplayStop,
	managedHarStart,
	managedHarStop,
} from "#engine/diagnose/har.js";
import {
	bool,
	type CliArgs,
	firstPos,
	print,
	session,
	str,
	stringArray,
	withCliError,
} from "./_helpers.js";

const replay = defineCommand({
	meta: {
		name: "replay",
		description:
			"Purpose: replay requests from a pre-recorded HAR file.\nOptions: pass the HAR file as the positional argument.\nExamples:\n  pw har replay ./fixture.har -s task-a\nNotes: sessions record full HAR by default; use this to replay a saved network fixture.",
	},
	args: sharedArgs,
	async run({ args }) {
		const a = args as CliArgs;
		try {
			print(
				"har replay",
				await managedHarReplay({
					sessionName: session(a),
					filePath: firstPos(a) as string,
				}),
				a,
			);
		} catch (e) {
			withCliError("har replay", a, e);
		}
	},
});
const replayStop = defineCommand({
	meta: {
		name: "replay-stop",
		description:
			"Purpose: stop HAR replay routing for the session.\nExamples:\n  pw har replay-stop -s task-a\nNotes: if route cleanup is limited, recreate the session to fully reset routing.",
	},
	args: sharedArgs,
	async run({ args }) {
		const a = args as CliArgs;
		try {
			print(
				"har replay-stop",
				await managedHarReplayStop({ sessionName: session(a) }),
				a,
			);
		} catch (e) {
			withCliError("har replay-stop", a, e);
		}
	},
});

const filter = defineCommand({
	meta: {
		name: "filter",
		description:
			"Purpose: derive a smaller HAR from a full captured HAR without changing the source.\nExamples:\n  pw har filter .pwcli/har/task/session.har --out failed.har --failed\n  pw har filter full.har --out api.har --url-regex '/api/' --status 400-599\nNotes: capture first, filter later; this command is for evidence reduction, not collection.",
	},
	args: {
		output: sharedArgs.output,
		out: { type: "string", description: "Output HAR path", valueHint: "path" },
		"url-contains": {
			type: "string",
			description: "Keep entries whose URL contains this text",
		},
		"url-regex": {
			type: "string",
			description: "Keep entries whose URL matches this regex",
		},
		"drop-url-regex": {
			type: "string",
			description: "Drop entries whose URL matches this regex",
		},
		method: {
			type: "string",
			description: "Comma-separated HTTP methods to keep",
		},
		status: {
			type: "string",
			description:
				"Comma-separated statuses or ranges, e.g. 500,502 or 400-599",
		},
		failed: { type: "boolean", description: "Keep only status >= 400" },
	},
	async run({ args }) {
		const a = args as CliArgs;
		try {
			const input = firstPos(a);
			const output = str(a.out);
			if (!input) throw new Error("har filter requires an input HAR path");
			if (!output) throw new Error("har filter requires --out <path>");
			print(
				"har filter",
				await managedHarFilter({
					input,
					output,
					urlContains: str(a["url-contains"]),
					urlRegex: str(a["url-regex"]),
					dropUrlRegex: str(a["drop-url-regex"]),
					method: str(a.method),
					status: str(a.status),
					failed: bool(a.failed),
				}),
				a,
			);
		} catch (e) {
			withCliError("har filter", a, e);
		}
	},
});

const clean = defineCommand({
	meta: {
		name: "clean",
		description:
			"Purpose: redact or strip sensitive/noisy fields from a copied HAR.\nExamples:\n  pw har clean full.har --out share.har --redact-header authorization,cookie --strip-cookies\n  pw har clean full.har --out no-body.har --strip-post-data --strip-content\nNotes: full HAR is the source of truth; clean only derived artifacts for sharing or handoff.",
	},
	args: {
		output: sharedArgs.output,
		out: { type: "string", description: "Output HAR path", valueHint: "path" },
		"redact-header": {
			type: "string",
			description: "Header names to redact; can be comma-separated or repeated",
			valueHint: "name[,name]",
		},
		"strip-cookies": {
			type: "boolean",
			description: "Remove cookie arrays and Cookie/Set-Cookie headers",
		},
		"strip-post-data": {
			type: "boolean",
			description: "Remove request postData",
		},
		"strip-content": {
			type: "boolean",
			description: "Remove response content text",
		},
	},
	async run({ args }) {
		const a = args as CliArgs;
		try {
			const input = firstPos(a);
			const output = str(a.out);
			if (!input) throw new Error("har clean requires an input HAR path");
			if (!output) throw new Error("har clean requires --out <path>");
			print(
				"har clean",
				await managedHarClean({
					input,
					output,
					redactHeaders: stringArray(a["redact-header"]).flatMap((item) =>
						item
							.split(",")
							.map((part) => part.trim())
							.filter(Boolean),
					),
					stripCookies: bool(a["strip-cookies"]),
					stripPostData: bool(a["strip-post-data"]),
					stripContent: bool(a["strip-content"]),
				}),
				a,
			);
		} catch (e) {
			withCliError("har clean", a, e);
		}
	},
});

const start = defineCommand({
	meta: {
		name: "start",
		description:
			"Purpose: start a targeted HAR recording window mid-session.\nOptions: --path is required.\nExamples:\n  pw har start -s task-a --path window.har\n  pw har start -s task-a --path api.har --url-filter '**/api/**'\nNotes: best used when you need a focused evidence window without restarting the session; if session lifecycle HAR is active, Playwright will reject a second recording.",
	},
	args: {
		output: sharedArgs.output,
		session: sharedArgs.session,
		path: {
			type: "string",
			description: "Output HAR path",
			valueHint: "path",
			required: true,
		},
		content: {
			type: "string",
			description: "HAR content policy: omit|embed|attach",
			valueHint: "policy",
		},
		mode: {
			type: "string",
			description: "HAR mode: full|minimal",
			valueHint: "mode",
		},
		"url-filter": {
			type: "string",
			description: "Glob or pattern of requests to include",
			valueHint: "pattern",
		},
	},
	async run({ args }) {
		const a = args as CliArgs;
		try {
			const path = str(a.path);
			if (!path) throw new Error("har start requires --path <file>");
			print(
				"har start",
				await managedHarStart({
					sessionName: session(a),
					path,
					content: str(a.content) as "omit" | "embed" | "attach" | undefined,
					mode: str(a.mode) as "full" | "minimal" | undefined,
					urlFilter: str(a["url-filter"]),
				}),
				a,
			);
		} catch (e) {
			withCliError("har start", a, e);
		}
	},
});

const stop = defineCommand({
	meta: {
		name: "stop",
		description:
			"Purpose: stop the mid-session HAR recording started by `pw har start`.\nExamples:\n  pw har stop -s task-a\nNotes: the HAR file is finalized and written when stop is called.",
	},
	args: {
		output: sharedArgs.output,
		session: sharedArgs.session,
	},
	async run({ args }) {
		const a = args as CliArgs;
		try {
			print("har stop", await managedHarStop({ sessionName: session(a) }), a);
		} catch (e) {
			withCliError("har stop", a, e);
		}
	},
});

export default defineCommand({
	meta: {
		name: "har",
		description: "HAR controls, filtering, cleaning and windowed recording",
	},
	subCommands: {
		replay,
		"replay-stop": replayStop,
		filter,
		clean,
		start,
		stop,
	},
});
