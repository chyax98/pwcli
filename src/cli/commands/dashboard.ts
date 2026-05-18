import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { defineCommand } from "citty";
import { bool, type CliArgs, print, printError, str } from "./_helpers.js";

const require = createRequire(import.meta.url);
const DASHBOARD_LAUNCH_OBSERVE_MS = 1000;

type DashboardLaunchFailure =
	| { error: Error; phase: "spawn" }
	| { code: number | null; phase: "early-exit"; signal: NodeJS.Signals | null };

function playwrightDashboardPaths() {
	const root = dirname(require.resolve("playwright-core/package.json"));
	return {
		cliClient: resolve(root, "lib", "tools", "cli-client", "cli.js"),
		helpJson: resolve(root, "lib", "tools", "cli-client", "help.json"),
	};
}

function showCommandAvailable(helpJson: string) {
	try {
		const parsed = JSON.parse(readFileSync(helpJson, "utf8")) as {
			commands?: Record<string, unknown>;
		};
		return Boolean(parsed.commands?.show);
	} catch {
		return false;
	}
}

function dashboardEnv() {
	return {
		...process.env,
		PLAYWRIGHT_DAEMON_SESSION_DIR:
			process.env.PLAYWRIGHT_DAEMON_SESSION_DIR ??
			resolve(".pwcli", "playwright-daemon"),
		PLAYWRIGHT_SERVER_REGISTRY:
			process.env.PLAYWRIGHT_SERVER_REGISTRY ??
			resolve(".pwcli", "playwright-registry"),
	};
}

function dashboardArgv(args: CliArgs) {
	const argv: string[] = [];
	const sessionName = str(args.session);
	if (sessionName) argv.push(`-s=${sessionName}`);
	argv.push("show");
	const port = str(args.port);
	const host = str(args.host);
	if (port) argv.push("--port", port);
	if (host) argv.push("--host", host);
	if (bool(args.annotate)) argv.push("--annotate");
	if (bool(args.kill)) argv.push("--kill");
	return argv;
}

export function observeDashboardLaunch(
	child: ChildProcess,
): Promise<DashboardLaunchFailure | null> {
	return new Promise((resolve) => {
		let settled = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const finish = (result: DashboardLaunchFailure | null) => {
			if (settled) return;
			settled = true;
			if (timer) clearTimeout(timer);
			child.off("error", onError);
			child.off("exit", onExit);
			resolve(result);
		};
		const onError = (error: Error) => finish({ error, phase: "spawn" });
		const onExit = (code: number | null, signal: NodeJS.Signals | null) =>
			finish({ code, phase: "early-exit", signal });
		timer = setTimeout(() => finish(null), DASHBOARD_LAUNCH_OBSERVE_MS);
		child.once("error", onError);
		child.once("exit", onExit);
	});
}

const open = defineCommand({
	meta: {
		name: "open",
		description:
			"Purpose: open Playwright's official session dashboard via playwright-cli show.\nExamples:\n  pw dashboard open\n  pw dashboard open --dry-run\n  pw dashboard open -s task-a --annotate\nNotes: this is a human observation escape hatch; Agent workflows should prefer CLI facts and diagnostics.",
	},
	args: {
		session: {
			type: "string",
			alias: "s",
			description: "Target managed session",
			valueHint: "name",
		},
		output: {
			type: "string",
			description: "Output format: text|json",
			default: "text",
		},
		"dry-run": {
			type: "boolean",
			description: "Validate delegated show command without launching",
		},
		port: {
			type: "string",
			description: "Dashboard HTTP port; use 0 for a random port",
		},
		host: {
			type: "string",
			description: "Dashboard HTTP host",
			valueHint: "host",
		},
		annotate: {
			type: "boolean",
			description: "Open dashboard annotation mode",
		},
		kill: {
			type: "boolean",
			description: "Ask the official dashboard daemon to stop",
		},
	},
	async run({ args }) {
		const a = args as CliArgs;
		const paths = playwrightDashboardPaths();
		const cliClientAvailable = existsSync(paths.cliClient);
		const helpAvailable = existsSync(paths.helpJson);
		const showAvailable = helpAvailable && showCommandAvailable(paths.helpJson);
		const argv = dashboardArgv(a);
		if (!cliClientAvailable || !showAvailable) {
			printError("dashboard open", a, {
				code: "DASHBOARD_UNAVAILABLE",
				message: "Playwright official dashboard show command is unavailable",
				details: { ...paths, cliClientAvailable, helpAvailable, showAvailable },
				suggestions: [
					"Run `pnpm install`",
					"Use `pw session list --with-page` for a CLI-only session overview",
					"Use `pw view open` or `pw stream start` for pwcli human observation flows",
				],
			});
			return;
		}
		if (bool(a["dry-run"])) {
			print(
				"dashboard open",
				{
					data: {
						available: true,
						delegatedCommand: "playwright-cli show",
						executable: process.execPath,
						argv: [paths.cliClient, ...argv],
						env: {
							PLAYWRIGHT_DAEMON_SESSION_DIR:
								dashboardEnv().PLAYWRIGHT_DAEMON_SESSION_DIR,
							PLAYWRIGHT_SERVER_REGISTRY:
								dashboardEnv().PLAYWRIGHT_SERVER_REGISTRY,
						},
						launched: false,
					},
				},
				a,
			);
			return;
		}

		const child = spawn(process.execPath, [paths.cliClient, ...argv], {
			detached: true,
			stdio: "ignore",
			env: dashboardEnv(),
		});
		const failure = await observeDashboardLaunch(child);
		if (failure && !(failure.phase === "early-exit" && failure.code === 0)) {
			printError("dashboard open", a, {
				code: "DASHBOARD_LAUNCH_FAILED",
				message: "Playwright dashboard subprocess failed during startup",
				details:
					failure.phase === "spawn"
						? { errorMessage: failure.error.message }
						: { exitCode: failure.code, signal: failure.signal },
			});
			return;
		}
		child.unref();
		print(
			"dashboard open",
			{
				data: {
					delegatedCommand: "playwright-cli show",
					executable: process.execPath,
					argv: [paths.cliClient, ...argv],
					launched: failure?.phase !== "early-exit",
					exitedCleanly: failure?.phase === "early-exit" && failure.code === 0,
				},
			},
			a,
		);
	},
});

export default defineCommand({
	meta: {
		name: "dashboard",
		description:
			"Purpose: open Playwright's official session dashboard via playwright-cli show.\nExamples:\n  pw dashboard open\n  pw dashboard open --dry-run\nNotes: this is a human observation escape hatch; Agent workflows should prefer CLI facts and diagnostics.",
	},
	subCommands: { open },
});
