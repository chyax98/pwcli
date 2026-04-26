(() => {
  const key = "__PWCLI_BOOTSTRAP_FIXTURE__";
  if (globalThis[key]?.installed) {
    return;
  }

  const summarizeText = (value) => {
    if (typeof value !== "string") {
      return "";
    }
    return value.length > 120 ? `${value.slice(0, 120)}...` : value;
  };

  const state = {
    installed: true,
    installedAt: new Date().toISOString(),
    initialHref: String(globalThis.location?.href ?? ""),
    documentMarks: [],
    requests: [],
  };

  const record = (entry) => {
    if (state.requests.length >= 20) {
      state.requests.shift();
    }
    state.requests.push({
      ...entry,
      at: new Date().toISOString(),
    });
  };

  const rememberDocument = (phase) => {
    const href = String(globalThis.location?.href ?? "");
    if (state.documentMarks.length >= 20) {
      state.documentMarks.shift();
    }
    state.documentMarks.push({
      phase,
      href,
      readyState: document.readyState,
      at: new Date().toISOString(),
    });
  };

  const tagDocument = (phase = "tag") => {
    try {
      document.documentElement?.setAttribute("data-pwcli-bootstrap-installed", "1");
      document.documentElement?.setAttribute(
        "data-pwcli-bootstrap-href",
        String(globalThis.location?.href ?? ""),
      );
    } catch {}
    rememberDocument(phase);
  };

  const originalFetch = globalThis.fetch?.bind(globalThis);
  if (originalFetch) {
    globalThis.fetch = async (...args) => {
      const [input, init] = args;
      const requestUrl =
        typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      const method =
        init?.method ?? (input instanceof Request && input.method ? input.method : "GET");

      try {
        const response = await originalFetch(...args);
        const responseBody = await response
          .clone()
          .text()
          .catch(() => "");
        record({
          kind: "fetch",
          method,
          url: requestUrl,
          status: response.status,
          route: response.headers.get("x-pwcli-route"),
          headerEcho: response.headers.get("x-pwcli-header"),
          bodyPreview: summarizeText(responseBody),
        });
        return response;
      } catch (error) {
        record({
          kind: "fetch",
          method,
          url: requestUrl,
          failed: true,
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    };
  }

  const xhrOpen = XMLHttpRequest.prototype.open;
  const xhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function open(method, url, ...rest) {
    this.__pwcliBootstrapRequest = {
      method,
      url: String(url),
    };
    return xhrOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function send(body) {
    this.addEventListener(
      "loadend",
      () => {
        const meta = this.__pwcliBootstrapRequest ?? {
          method: "GET",
          url: "",
        };
        record({
          kind: "xhr",
          method: meta.method,
          url: meta.url,
          status: this.status,
          route: this.getResponseHeader("x-pwcli-route"),
          headerEcho: this.getResponseHeader("x-pwcli-header"),
          bodyPreview: summarizeText(this.responseText),
        });
      },
      { once: true },
    );
    return xhrSend.call(this, body);
  };

  globalThis[key] = state;
  globalThis.__pwcliBootstrapSnapshot = () => JSON.parse(JSON.stringify(state));
  globalThis.__pwcliBootstrapFetch = async (url, init) => {
    const response = await globalThis.fetch(url, {
      cache: "no-store",
      ...init,
    });
    const body = await response
      .clone()
      .text()
      .catch(() => "");
    return {
      url: response.url || String(url),
      status: response.status,
      route: response.headers.get("x-pwcli-route"),
      headerEcho: response.headers.get("x-pwcli-header"),
      body: summarizeText(body),
    };
  };
  globalThis.__pwcliBootstrapXhr = (url, method = "GET") =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, url, true);
      xhr.addEventListener("load", () => {
        resolve({
          url,
          status: xhr.status,
          route: xhr.getResponseHeader("x-pwcli-route"),
          headerEcho: xhr.getResponseHeader("x-pwcli-header"),
          body: summarizeText(xhr.responseText),
        });
      });
      xhr.addEventListener("error", () => {
        reject(new Error(`xhr-error:${url}`));
      });
      xhr.send();
    });

  tagDocument("install");
  document.addEventListener(
    "readystatechange",
    () => {
      tagDocument(`readystatechange-${document.readyState}`);
    },
    { once: false },
  );
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      tagDocument("domcontentloaded");
    },
    { once: true },
  );
  globalThis.addEventListener(
    "load",
    () => {
      tagDocument("load");
    },
    { once: true },
  );
})();
