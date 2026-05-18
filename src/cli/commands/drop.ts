import { defineCommand } from "citty";
import { actionArgs } from "#cli/args.js";
import { managedDrop } from "#engine/act/page.js";
import {
	actionTarget,
	type CliArgs,
	positionals,
	print,
	session,
	stringArray,
	withCliError,
} from "./_helpers.js";

export default defineCommand({
	meta: {
		name: "drop",
		description:
			"Purpose: drop files or MIME data onto a target element using Playwright locator.drop().\nExamples:\n  pw drop -s task-a --selector '#dropzone' --path ./fixture.txt\n  pw drop -s task-a e12 --data 'text/plain=hello'\nNotes: target by ref, selector, or semantic locator. Use --data as mime/type=value; repeat --path or --data for multiple payload entries.",
	},
	args: {
		...actionArgs,
		path: {
			type: "string",
			description: "File path to drop; repeat for multiple files",
			valueHint: "path",
		},
		data: {
			type: "string",
			description:
				"MIME data in mime/type=value format; repeat for multiple entries",
			valueHint: "mime/type=value",
		},
	},
	async run({ args }) {
		const a = args as CliArgs;
		try {
			const parts = positionals(a);
			const target = actionTarget(a, parts[0]);
			print(
				"drop",
				await managedDrop({
					sessionName: session(a),
					ref: target.ref,
					selector: target.selector,
					semantic: target.semantic,
					nth: target.nth,
					paths: stringArray(a.path),
					data: stringArray(a.data),
				}),
				a,
			);
		} catch (error) {
			withCliError("drop", a, error, "drop failed");
		}
	},
});
