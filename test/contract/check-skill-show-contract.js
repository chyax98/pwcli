import { parseJson, runPwSync } from "./_helpers.js";

const refsResult = runPwSync(["skill", "refs", "--output", "json"]);
if (refsResult.status !== 0) {
  throw new Error(`skill refs failed\n${refsResult.stdout}\n${refsResult.stderr}`);
}
const refsPayload = parseJson(refsResult.stdout, "skill refs");
if (
  refsPayload.ok !== true ||
  !Array.isArray(refsPayload.data?.references) ||
  refsPayload.data.references.length < 4
) {
  throw new Error(`unexpected skill refs payload: ${JSON.stringify(refsPayload, null, 2)}`);
}

const showMain = runPwSync(["skill", "show", "--output", "json"]);
if (showMain.status !== 0) {
  throw new Error(`skill show failed\n${showMain.stdout}\n${showMain.stderr}`);
}
const mainPayload = parseJson(showMain.stdout, "skill show");
if (
  mainPayload.ok !== true ||
  mainPayload.data?.key !== "main" ||
  typeof mainPayload.data?.content !== "string" ||
  !mainPayload.data.content.includes("# pwcli")
) {
  throw new Error(`unexpected skill show payload: ${JSON.stringify(mainPayload, null, 2)}`);
}

const showRef = runPwSync(["skill", "show", "forge-dc-auth", "--output", "json"]);
if (showRef.status !== 0) {
  throw new Error(`skill show forge-dc-auth failed\n${showRef.stdout}\n${showRef.stderr}`);
}
const refPayload = parseJson(showRef.stdout, "skill show forge-dc-auth");
if (
  refPayload.ok !== true ||
  refPayload.data?.key !== "forge-dc-auth" ||
  !String(refPayload.data?.content ?? "").includes("auth dc")
) {
  throw new Error(`unexpected skill show ref payload: ${JSON.stringify(refPayload, null, 2)}`);
}

const showFull = runPwSync(["skill", "show", "--full", "--output", "json"]);
if (showFull.status !== 0) {
  throw new Error(`skill show --full failed\n${showFull.stdout}\n${showFull.stderr}`);
}
const fullPayload = parseJson(showFull.stdout, "skill show --full");
if (
  fullPayload.ok !== true ||
  fullPayload.data?.full !== true ||
  !Array.isArray(fullPayload.data?.sections) ||
  fullPayload.data.sections.length < 4
) {
  throw new Error(`unexpected skill show full payload: ${JSON.stringify(fullPayload, null, 2)}`);
}
