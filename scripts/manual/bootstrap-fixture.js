(() => {
  const key = '__PWCLI_BOOTSTRAP_FIXTURE__';
  if (globalThis[key]?.installed) {
    return;
  }

  const state = {
    installed: true,
    installedAt: new Date().toISOString(),
    initialHref: String(globalThis.location?.href ?? ''),
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

  const tagDocument = () => {
    try {
      document.documentElement?.setAttribute('data-pwcli-bootstrap-installed', '1');
    } catch {}
  };

  const originalFetch = globalThis.fetch?.bind(globalThis);
  if (originalFetch) {
    globalThis.fetch = async (...args) => {
      const [input, init] = args;
      const requestUrl =
        typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
      const method =
        init?.method ??
        (input instanceof Request && input.method ? input.method : 'GET');

      try {
        const response = await originalFetch(...args);
        record({
          kind: 'fetch',
          method,
          url: requestUrl,
          status: response.status,
          route: response.headers.get('x-pwcli-route'),
          headerEcho: response.headers.get('x-pwcli-header'),
        });
        return response;
      } catch (error) {
        record({
          kind: 'fetch',
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
      'loadend',
      () => {
        const meta = this.__pwcliBootstrapRequest ?? {
          method: 'GET',
          url: '',
        };
        record({
          kind: 'xhr',
          method: meta.method,
          url: meta.url,
          status: this.status,
          route: this.getResponseHeader('x-pwcli-route'),
          headerEcho: this.getResponseHeader('x-pwcli-header'),
        });
      },
      { once: true },
    );
    return xhrSend.call(this, body);
  };

  globalThis[key] = state;
  globalThis.__pwcliBootstrapSnapshot = () => JSON.parse(JSON.stringify(state));

  tagDocument();
  document.addEventListener('DOMContentLoaded', tagDocument, { once: true });
})();
