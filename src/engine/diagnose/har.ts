import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { managedRunCode, stateAccessPrelude } from "../shared.js";

export async function managedHarReplay(options: {
	filePath: string;
	sessionName?: string;
}) {
	const resolvedPath = resolve(options.filePath);
	const result = await managedRunCode({
		sessionName: options.sessionName,
		source: `async page => {
      ${stateAccessPrelude()}
      const previousRoutes = new Set(context._routes || []);
      await context.routeFromHAR(${JSON.stringify(resolvedPath)}, {
        notFound: 'abort',
      });
      const harRoutes = (context._routes || []).filter(r => !previousRoutes.has(r));
      state.harReplay = {
        active: true,
        file: ${JSON.stringify(resolvedPath)},
        startedAt: new Date().toISOString(),
        harRoutes,
      };
      return JSON.stringify({ replayActive: true, file: ${JSON.stringify(resolvedPath)} });
    }`,
	});
	const parsed =
		typeof result.data.result === "object" && result.data.result
			? result.data.result
			: {};

	return {
		session: result.session,
		page: result.page,
		data: {
			replayActive: true,
			file: resolvedPath,
			...(parsed as Record<string, unknown>),
		},
	};
}

export async function managedHarReplayStop(options: { sessionName?: string }) {
	const result = await managedRunCode({
		sessionName: options.sessionName,
		source: `async page => {
      ${stateAccessPrelude()}
      const harRoutes = state.harReplay?.harRoutes || [];
      let clearedCount = 0;
      if (harRoutes.length && context._routes) {
        for (const routeHandler of harRoutes) {
          try {
            await context.unroute(routeHandler.url, routeHandler.handler);
            clearedCount++;
          } catch (e) {}
        }
      }
      if (typeof context._disposeHarRouters === 'function') {
        context._disposeHarRouters();
      }
      const usedFallback = clearedCount === 0;
      // Do not call unrouteAll() or reset state.routes — that would destroy unrelated pw route add mocks.
      // If HAR routes could not be individually cleared, record a limitation and leave other routes intact.
      state.harReplay = {
        active: false,
        stoppedAt: new Date().toISOString(),
      };
      return JSON.stringify({
        replayActive: false,
        ...(usedFallback ? { limitation: 'HAR replay routes could not be individually removed; replay may still be active. Use pw session recreate to fully reset routing.' } : {}),
      });
    }`,
	});
	const parsed =
		typeof result.data.result === "object" && result.data.result
			? result.data.result
			: {};

	return {
		session: result.session,
		page: result.page,
		data: {
			replayActive: false,
			...(parsed as Record<string, unknown>),
		},
	};
}

type HarHeader = { name?: string; value?: string };
type HarEntry = {
	request?: {
		method?: string;
		url?: string;
		headers?: HarHeader[];
		cookies?: unknown[];
		postData?: unknown;
	};
	response?: {
		status?: number;
		headers?: HarHeader[];
		cookies?: unknown[];
		content?: { text?: string; [key: string]: unknown };
	};
	[key: string]: unknown;
};

type HarFile = {
	log?: {
		entries?: HarEntry[];
		[key: string]: unknown;
	};
	[key: string]: unknown;
};

export type HarFilterOptions = {
	input: string;
	output: string;
	urlContains?: string;
	urlRegex?: string;
	dropUrlRegex?: string;
	method?: string;
	status?: string;
	failed?: boolean;
};

export type HarCleanOptions = {
	input: string;
	output: string;
	redactHeaders?: string[];
	stripCookies?: boolean;
	stripPostData?: boolean;
	stripContent?: boolean;
};

function parseCsv(value: string | undefined): string[] {
	return (value ?? "")
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

function parseStatusMatcher(
	value: string | undefined,
): ((status: number | undefined) => boolean) | undefined {
	const parts = parseCsv(value);
	if (!parts.length) return undefined;
	const matchers = parts.map((part) => {
		const range = part.match(/^(\d{3})-(\d{3})$/);
		if (range) {
			const from = Number(range[1]);
			const to = Number(range[2]);
			return (status: number | undefined) =>
				status !== undefined && status >= from && status <= to;
		}
		const exact = Number(part);
		if (!Number.isInteger(exact))
			throw new Error(`Invalid --status value: ${part}`);
		return (status: number | undefined) => status === exact;
	});
	return (status) => matchers.some((matcher) => matcher(status));
}

async function readHar(
	input: string,
): Promise<{ path: string; har: HarFile; entries: HarEntry[] }> {
	const path = resolve(input);
	const har = JSON.parse(await readFile(path, "utf8")) as HarFile;
	const entries = har.log?.entries;
	if (!Array.isArray(entries))
		throw new Error(`HAR file has no log.entries array: ${path}`);
	return { path, har, entries };
}

async function writeHar(output: string, har: HarFile) {
	const path = resolve(output);
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, `${JSON.stringify(har, null, 2)}\n`, "utf8");
	return path;
}

export async function managedHarFilter(options: HarFilterOptions) {
	const { path: inputPath, har, entries } = await readHar(options.input);
	const urlRegex = options.urlRegex ? new RegExp(options.urlRegex) : undefined;
	const dropUrlRegex = options.dropUrlRegex
		? new RegExp(options.dropUrlRegex)
		: undefined;
	const methods = new Set(
		parseCsv(options.method).map((item) => item.toUpperCase()),
	);
	const statusMatcher = parseStatusMatcher(options.status);
	const filtered = entries.filter((entry) => {
		const url = entry.request?.url ?? "";
		const status = entry.response?.status;
		if (options.urlContains && !url.includes(options.urlContains)) return false;
		if (urlRegex && !urlRegex.test(url)) return false;
		if (dropUrlRegex?.test(url)) return false;
		if (
			methods.size &&
			!methods.has((entry.request?.method ?? "").toUpperCase())
		)
			return false;
		if (statusMatcher && !statusMatcher(status)) return false;
		if (options.failed && !(typeof status === "number" && status >= 400))
			return false;
		return true;
	});
	const nextHar: HarFile = {
		...har,
		log: { ...(har.log ?? {}), entries: filtered },
	};
	const outputPath = await writeHar(options.output, nextHar);
	return {
		data: {
			input: inputPath,
			output: outputPath,
			originalEntryCount: entries.length,
			entryCount: filtered.length,
			removedEntryCount: entries.length - filtered.length,
		},
	};
}

function cleanHeaders(
	headers: HarHeader[] | undefined,
	redacted: Set<string>,
	stripCookies: boolean,
) {
	if (!Array.isArray(headers)) return headers;
	return headers
		.filter(
			(header) =>
				!(
					stripCookies &&
					["cookie", "set-cookie"].includes((header.name ?? "").toLowerCase())
				),
		)
		.map((header) =>
			redacted.has((header.name ?? "").toLowerCase())
				? { ...header, value: "<redacted>" }
				: header,
		);
}

export async function managedHarClean(options: HarCleanOptions) {
	const { path: inputPath, har, entries } = await readHar(options.input);
	const redacted = new Set(
		options.redactHeaders?.map((item) => item.toLowerCase()) ?? [],
	);
	let changedEntries = 0;
	const cleaned = entries.map((entry) => {
		const requestHeaders = cleanHeaders(
			entry.request?.headers,
			redacted,
			Boolean(options.stripCookies),
		);
		const responseHeaders = cleanHeaders(
			entry.response?.headers,
			redacted,
			Boolean(options.stripCookies),
		);
		const request = entry.request
			? {
					...entry.request,
					...(requestHeaders ? { headers: requestHeaders } : {}),
				}
			: undefined;
		const response = entry.response
			? {
					...entry.response,
					...(responseHeaders ? { headers: responseHeaders } : {}),
				}
			: undefined;

		if (request && options.stripCookies) delete request.cookies;
		if (response && options.stripCookies) delete response.cookies;
		if (request && options.stripPostData) delete request.postData;
		if (response?.content && options.stripContent)
			response.content = { ...response.content, text: "" };

		const nextEntry = {
			...entry,
			...(request ? { request } : {}),
			...(response ? { response } : {}),
		};
		if (JSON.stringify(nextEntry) !== JSON.stringify(entry)) changedEntries++;
		return nextEntry;
	});

	const nextHar: HarFile = {
		...har,
		log: { ...(har.log ?? {}), entries: cleaned },
	};
	const outputPath = await writeHar(options.output, nextHar);
	return {
		data: {
			input: inputPath,
			output: outputPath,
			entryCount: entries.length,
			changedEntryCount: changedEntries,
			redactedHeaders: [...redacted],
			stripCookies: Boolean(options.stripCookies),
			stripPostData: Boolean(options.stripPostData),
			stripContent: Boolean(options.stripContent),
		},
	};
}

export async function managedHarStart(options: {
	sessionName?: string;
	path: string;
	content?: "omit" | "embed" | "attach";
	mode?: "full" | "minimal";
	urlFilter?: string;
}) {
	const resolvedPath = resolve(options.path);
	const result = await managedRunCode({
		sessionName: options.sessionName,
		source: `async page => {
      ${stateAccessPrelude()}
      const opts = {};
      ${options.content ? `opts.content = ${JSON.stringify(options.content)};` : ""}
      ${options.mode ? `opts.mode = ${JSON.stringify(options.mode)};` : ""}
      ${options.urlFilter ? `opts.urlFilter = ${JSON.stringify(options.urlFilter)};` : ""}
      await context.tracing.startHar(${JSON.stringify(resolvedPath)}, opts);
      return JSON.stringify({ harStarted: true, path: ${JSON.stringify(resolvedPath)} });
    }`,
	});

	return {
		session: result.session,
		page: result.page,
		data: {
			harStarted: true,
			path: resolvedPath,
			...(options.content ? { content: options.content } : {}),
			...(options.mode ? { mode: options.mode } : {}),
		},
	};
}

export async function managedHarStop(options: { sessionName?: string }) {
	const result = await managedRunCode({
		sessionName: options.sessionName,
		source: `async page => {
      ${stateAccessPrelude()}
      await context.tracing.stopHar();
      return JSON.stringify({ harStopped: true });
    }`,
	});

	return {
		session: result.session,
		page: result.page,
		data: {
			harStopped: true,
		},
	};
}
