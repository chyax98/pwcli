import { parseJson, runPwSync } from "./_helpers.js";

function runJsonCase(label, args, options = {}) {
	const result = runPwSync(args, options);
	if (result.status !== 0) {
		throw new Error(
			`${label} failed with status ${result.status}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
		);
	}
	const data = parseJson(result.stdout, label);
	if (data.ok !== true) {
		throw new Error(`${label} returned non-ok JSON: ${result.stdout}`);
	}
	return data;
}

const envList = runJsonCase(
	"commands list honors PWCLI_OUTPUT=json",
	["commands", "list"],
	{ env: { ...process.env, PWCLI_OUTPUT: "json" } },
);
if (
	envList.command !== "commands list" ||
	!Array.isArray(envList.data?.commands)
) {
	throw new Error(
		`unexpected commands list payload: ${JSON.stringify(envList)}`,
	);
}

const argvSearch = runJsonCase(
	"commands search honors --output=json argv placement",
	["commands", "search", "recovery", "--output=json"],
);
if (
	argvSearch.command !== "commands search" ||
	argvSearch.data?.query !== "recovery" ||
	argvSearch.data?.count < 1
) {
	throw new Error(
		`unexpected commands search payload: ${JSON.stringify(argvSearch)}`,
	);
}

const separatedArgvHelp = runJsonCase(
	"commands help honors separated --output json argv placement",
	["commands", "help", "code", "--output", "json"],
);
if (separatedArgvHelp.data?.command?.name !== "code") {
	throw new Error(
		`unexpected commands help payload: ${JSON.stringify(separatedArgvHelp)}`,
	);
}

const explicitText = runPwSync(["commands", "help", "code", "--output=text"], {
	env: { ...process.env, PWCLI_OUTPUT: "json" },
});
if (explicitText.status !== 0 || explicitText.stdout.trim().startsWith("{")) {
	throw new Error(
		`explicit --output=text did not override PWCLI_OUTPUT=json: ${explicitText.stdout}`,
	);
}

const invalid = runPwSync(["commands", "list", "--layer", "bogus"], {
	env: { ...process.env, PWCLI_OUTPUT: "json" },
});
if (invalid.status === 0) {
	throw new Error("expected invalid layer to fail");
}
const invalidPayload = parseJson(
	invalid.stdout,
	"commands list invalid layer honors PWCLI_OUTPUT=json",
);
if (
	invalidPayload.ok !== false ||
	invalidPayload.error?.code !== "UNKNOWN_LAYER"
) {
	throw new Error(
		`unexpected invalid layer payload: ${JSON.stringify(invalidPayload)}`,
	);
}
