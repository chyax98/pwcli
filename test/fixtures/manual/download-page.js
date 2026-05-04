import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const outputPath = resolve(".tmp-download.html");

await mkdir(resolve(".tmp-downloads"), { recursive: true });
await writeFile(
  outputPath,
  `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>pwcli download smoke</title>
  </head>
  <body>
    <a id="dl" download="sample.txt" href="data:text/plain,hello">Download</a>
  </body>
</html>`,
  "utf8",
);

process.stdout.write(`${outputPath}\n`);
