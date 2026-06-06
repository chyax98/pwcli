import { defineCommand } from "citty";
import {
	type CommandLayer,
	type CommandMetadata,
	commandLayers,
	commandMetadata,
} from "#cli/command-metadata.js";
import { type CliArgs, output, positionals, str } from "./_helpers.js";

function matchesTopic(command: CommandMetadata, query: string) {
	const needle = query.trim().toLowerCase();
	if (!needle) return true;
	const haystack = [
		command.name,
		command.layer,
		command.mutability,
		command.session,
		command.description,
		...command.topics,
	]
		.join(" ")
		.toLowerCase();
	return haystack.includes(needle);
}

function isCommandLayer(value: string): value is CommandLayer {
	return (commandLayers as string[]).includes(value);
}

function byLayer(layer?: CommandLayer) {
	if (!layer) return commandMetadata;
	return commandMetadata.filter((command) => command.layer === layer);
}

function textTable(commands: CommandMetadata[]) {
	return commands
		.map(
			(command) =>
				`${command.name.padEnd(17)} ${command.layer.padEnd(10)} ${command.mutability.padEnd(6)} ${command.session.padEnd(8)} ${command.description}`,
		)
		.join("\n");
}

function printResult(
	args: CliArgs,
	command: string,
	data: Record<string, unknown>,
	text: string,
) {
	if (output(args) === "json") {
		process.stdout.write(
			`${JSON.stringify({ ok: true, command, data }, null, 2)}\n`,
		);
		return;
	}
	process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
}

function printJsonError(
	command: string,
	code: string,
	message: string,
	suggestions: string[],
	details: Record<string, unknown> = {},
) {
	process.stdout.write(
		`${JSON.stringify({ ok: false, command, error: { code, message, retryable: false, suggestions, details } }, null, 2)}\n`,
	);
}

const list = defineCommand({
	meta: {
		name: "list",
		description:
			"Purpose: list pw commands with agent-facing layers, mutability, and session requirements.\nExamples:\n  pw commands list\n  pw commands list --layer observe\nNotes: use `pw <command> --help` for exact flags.",
	},
	args: {
		output: {
			type: "string",
			description: "Output format: text|json",
			default: "text",
		},
		layer: {
			type: "string",
			description: `Filter by layer: ${commandLayers.join("|")}`,
			valueHint: "layer",
		},
	},
	run({ args }) {
		const cliArgs = args as CliArgs;
		const layer = str(cliArgs.layer);
		if (layer && !isCommandLayer(layer)) {
			process.exitCode = 1;
			const message = `Unknown layer: ${layer}`;
			const suggestions = [`Use one of: ${commandLayers.join(", ")}`];
			if (output(cliArgs) === "json") {
				printJsonError("commands list", "UNKNOWN_LAYER", message, suggestions, {
					allowedLayers: commandLayers,
				});
				return;
			}
			process.stderr.write(`${message}\n${suggestions[0]}\n`);
			return;
		}
		const layerFilter = layer as CommandLayer | undefined;
		const commands = byLayer(layerFilter);
		printResult(
			cliArgs,
			"commands list",
			{ commands, count: commands.length },
			textTable(commands),
		);
	},
});

const search = defineCommand({
	meta: {
		name: "search",
		description:
			"Purpose: search pw command discovery metadata by topic, name, layer, or description.\nExamples:\n  pw commands search electron\n  pw commands search recovery\nNotes: output is a routing aid; use command help for exact parameters.",
	},
	args: {
		output: {
			type: "string",
			description: "Output format: text|json",
			default: "text",
		},
	},
	run({ args }) {
		const cliArgs = args as CliArgs;
		const query = positionals(cliArgs).join(" ");
		const commands = commandMetadata.filter((command) =>
			matchesTopic(command, query),
		);
		printResult(
			cliArgs,
			"commands search",
			{ query, commands, count: commands.length },
			textTable(commands),
		);
	},
});

const help = defineCommand({
	meta: {
		name: "help",
		description:
			"Purpose: show agent-facing routing metadata for one command.\nExamples:\n  pw commands help snapshot\n  pw commands help code\nNotes: use `pw <command> --help` next for exact flags.",
	},
	args: {
		output: {
			type: "string",
			description: "Output format: text|json",
			default: "text",
		},
	},
	run({ args }) {
		const cliArgs = args as CliArgs;
		const name = positionals(cliArgs)[0];
		const command = commandMetadata.find((item) => item.name === name);
		if (!command) {
			process.exitCode = 1;
			const message = `Unknown command: ${name ?? ""}`;
			const suggestions = ["Run `pw commands list`"];
			if (output(cliArgs) === "json") {
				printJsonError(
					"commands help",
					"COMMAND_NOT_FOUND",
					message,
					suggestions,
				);
				return;
			}
			process.stderr.write(`${message}\n${suggestions[0]}\n`);
			return;
		}
		const text = [
			`${command.name}`,
			`layer: ${command.layer}`,
			`mutability: ${command.mutability}`,
			`session: ${command.session}`,
			`description: ${command.description}`,
			`topics: ${command.topics.join(", ")}`,
			`next: pw ${command.name} --help`,
		].join("\n");
		printResult(cliArgs, "commands help", { command }, text);
	},
});

export default defineCommand({
	meta: {
		name: "commands",
		description:
			"Purpose: discover pw commands by agent-facing layer, mutability, session requirement, and topic.\nExamples:\n  pw commands list\n  pw commands search electron\n  pw commands help snapshot\nNotes: this is workflow routing metadata; `pw <command> --help` remains parameter truth.",
	},
	subCommands: { list, search, help },
});
