import assert from "node:assert/strict";
import test from "node:test";
import { commandMetadata } from "../../src/cli/command-metadata.js";
import subCommands from "../../src/cli/commands/index.js";

test("command metadata covers every top-level command", () => {
	const commandNames = Object.keys(subCommands).sort();
	const metadataNames = commandMetadata.map((command) => command.name).sort();

	assert.deepEqual(metadataNames, commandNames);
});

test("command metadata names are unique and searchable", () => {
	const names = commandMetadata.map((command) => command.name);
	assert.equal(new Set(names).size, names.length);

	for (const command of commandMetadata) {
		assert.ok(
			command.description.length > 0,
			`${command.name} has description`,
		);
		assert.ok(
			command.topics.includes(command.name) || command.topics.length > 0,
		);
	}
});
