type AllowedDomainState = {
  allowedDomains: string[];
  updatedAt: string;
};

function normalizePattern(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeAllowedDomains(domains: string[]) {
  return Array.from(new Set(domains.map(normalizePattern).filter(Boolean)));
}

export function isUrlAllowed(url: string, domains: string[]) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return domains.some((pattern) => {
      if (pattern.startsWith("*.")) {
        const suffix = pattern.slice(2);
        return host === suffix || host.endsWith(`.${suffix}`);
      }
      return host === pattern;
    });
  } catch {
    return false;
  }
}

export function domainGuardPrelude(domains: string[]) {
  return `
    const allowedDomains = ${JSON.stringify(domains)};
    const normalizeHost = value => {
      try {
        return new URL(value, location.href).hostname.toLowerCase();
      } catch {
        return null;
      }
    };
    const isAllowedUrl = value => {
      const host = normalizeHost(value);
      if (!host) return false;
      return allowedDomains.some(pattern => {
        if (pattern.startsWith('*.')) {
          const suffix = pattern.slice(2);
          return host === suffix || host.endsWith('.' + suffix);
        }
        return host === pattern;
      });
    };
    const fail = value => {
      throw new Error('DOMAIN_NOT_ALLOWED:' + String(value));
    };
    window.__pwcliAllowedDomains = allowedDomains;
    if (!window.__pwcliDomainGuardInstalled) {
      window.__pwcliDomainGuardInstalled = true;
      const originalFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input?.url;
        if (url && !isAllowedUrl(url)) fail(url);
        return originalFetch(input, init);
      };
      const originalSendBeacon = navigator.sendBeacon?.bind(navigator);
      if (originalSendBeacon) {
        navigator.sendBeacon = (url, data) => {
          if (url && !isAllowedUrl(url)) fail(url);
          return originalSendBeacon(url, data);
        };
      }
      if (typeof WebSocket !== 'undefined') {
        const OriginalWebSocket = window.WebSocket;
        window.WebSocket = function(url, protocols) {
          if (url && !isAllowedUrl(url)) fail(url);
          return new OriginalWebSocket(url, protocols);
        };
        window.WebSocket.prototype = OriginalWebSocket.prototype;
      }
      if (typeof EventSource !== 'undefined') {
        const OriginalEventSource = window.EventSource;
        window.EventSource = function(url, init) {
          if (url && !isAllowedUrl(url)) fail(url);
          return new OriginalEventSource(url, init);
        };
        window.EventSource.prototype = OriginalEventSource.prototype;
      }
    }
  `;
}

export function buildAllowedDomainState(domains: string[]): AllowedDomainState {
  return {
    allowedDomains: domains,
    updatedAt: new Date().toISOString(),
  };
}
