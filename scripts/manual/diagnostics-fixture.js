async (page) => {
  await page.setContent(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>pwcli diagnostics fixture</title>
      </head>
      <body>
        <main>
          <h1>pwcli diagnostics fixture</h1>
          <p id="status">idle</p>
          <p id="run-count">0</p>
          <p id="last-request-token">none</p>
          <p id="last-response-token">none</p>
          <p id="last-route-result">none</p>
          <button id="fire" type="button">fire</button>
          <button id="route-only" type="button">route-only</button>
          <button id="arm-request" type="button">arm-request</button>
          <button id="arm-response" type="button">arm-response</button>
        </main>
        <script>
          const statusEl = document.getElementById('status');
          const runCountEl = document.getElementById('run-count');
          const lastRequestTokenEl = document.getElementById('last-request-token');
          const lastResponseTokenEl = document.getElementById('last-response-token');
          const lastRouteResultEl = document.getElementById('last-route-result');
          const fireButton = document.getElementById('fire');
          const routeOnlyButton = document.getElementById('route-only');
          const armRequestButton = document.getElementById('arm-request');
          const armResponseButton = document.getElementById('arm-response');
          const fixtureOrigin =
            globalThis.location?.origin && globalThis.location.origin !== 'null'
              ? globalThis.location.origin
              : 'http://127.0.0.1:4179';
          const diagnosticsBasePath = '/__pwcli__/diagnostics';
          const waitBasePath = '/__pwcli__/wait';
          const waitDelayMs = 3000;

          let runCount = 0;
          let waitTokenSeq = 0;

          const setStatus = (value) => {
            statusEl.textContent = value;
            runCountEl.textContent = String(runCount);
          };

          const summarizeText = (value) => {
            if (typeof value !== 'string')
              return '';
            return value.length > 80 ? value.slice(0, 80) + '...' : value;
          };

          const absoluteFixtureUrl = (path) => new URL(path, fixtureOrigin).toString();

          const nextWaitToken = (prefix) =>
            prefix + '-' + String(++waitTokenSeq).padStart(2, '0');

          const fetchProbe = async (path) => {
            const response = await fetch(path, {
              cache: 'no-store',
            });
            const body = summarizeText(await response.text());
            return {
              path,
              status: response.status,
              body,
            };
          };

          const xhrProbe = (path) =>
            new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open('GET', path, true);
              xhr.addEventListener('load', () => {
                resolve({
                  path,
                  status: xhr.status,
                  body: summarizeText(xhr.responseText),
                });
              });
              xhr.addEventListener('error', () => {
                reject(new Error('xhr-error:' + path));
              });
              xhr.send();
            });

          const emitPageError = (currentRun) => {
            setTimeout(() => {
              throw new Error('fixture-page-error-run-' + currentRun);
            }, 0);
          };

          const emitRouteTarget = async (currentRun) => {
            const result = await fetchProbe(
              absoluteFixtureUrl(diagnosticsBasePath + '/route-hit?run=' + currentRun),
            );
            const summary = result.status + ':' + result.body;
            lastRouteResultEl.textContent = summary;
            console.log('fixture-route-hit-run-' + currentRun, result.status, result.body);
            return result;
          };

          const emitDiagnostics = async () => {
            runCount += 1;
            const currentRun = runCount;
            setStatus('running-' + currentRun);

            console.log('fixture-log-run-' + currentRun);
            console.warn('fixture-warn-run-' + currentRun);
            console.error('fixture-error-run-' + currentRun);

            const fetchResult = await fetchProbe(
              absoluteFixtureUrl(diagnosticsBasePath + '/fetch?run=' + currentRun),
            );
            console.log('fixture-fetch-run-' + currentRun, fetchResult.status, fetchResult.body);

            const xhrResult = await xhrProbe(
              absoluteFixtureUrl(diagnosticsBasePath + '/xhr?run=' + currentRun),
            );
            console.log('fixture-xhr-run-' + currentRun, xhrResult.status, xhrResult.body);

            const routeResult = await emitRouteTarget(currentRun);
            emitPageError(currentRun);

            setStatus(
              'done-' +
                currentRun +
                ':' +
                fetchResult.status +
                '/' +
                xhrResult.status +
                '/' +
                routeResult.status,
            );
          };

          const armRequestWait = (delayMs = waitDelayMs, tokenOverride) => {
            const token =
              typeof tokenOverride === 'string' && tokenOverride
                ? tokenOverride
                : nextWaitToken('request');
            const path = absoluteFixtureUrl(
              waitBasePath + '/request?token=' + encodeURIComponent(token),
            );
            lastRequestTokenEl.textContent = token;
            setStatus('armed-request-' + token + ':' + delayMs);
            window.setTimeout(async () => {
              const result = await fetchProbe(path);
              console.log('fixture-wait-request-fired', token, result.status, result.body);
              setStatus('request-fired-' + token);
            }, delayMs);
            return token;
          };

          const armResponseWait = (delayMs = waitDelayMs, tokenOverride) => {
            const token =
              typeof tokenOverride === 'string' && tokenOverride
                ? tokenOverride
                : nextWaitToken('response');
            const path = absoluteFixtureUrl(
              waitBasePath + '/response?token=' + encodeURIComponent(token),
            );
            lastResponseTokenEl.textContent = token;
            setStatus('armed-response-' + token + ':' + delayMs);
            window.setTimeout(async () => {
              const result = await fetchProbe(path);
              console.log('fixture-wait-response-fired', token, result.status, result.body);
              setStatus('response-fired-' + token);
            }, delayMs);
            return token;
          };

          fireButton.addEventListener('click', () => {
            void emitDiagnostics();
          });

          routeOnlyButton.addEventListener('click', () => {
            runCount += 1;
            const currentRun = runCount;
            setStatus('route-only-' + currentRun);
            void emitRouteTarget(currentRun).then((result) => {
              setStatus('route-only-' + currentRun + ':' + result.status);
            });
          });

          armRequestButton.addEventListener('click', () => {
            armRequestWait();
          });

          armResponseButton.addEventListener('click', () => {
            armResponseWait();
          });

          window.__pwcliDiagnosticsFixture = {
            waitDelayMs,
            emitDiagnostics,
            emitRouteTarget,
            armRequestWait,
            armResponseWait,
          };
        </script>
      </body>
    </html>
  `);

  return "ready";
};
