async page => {
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
          <button id="fire" type="button">fire</button>
          <button id="route-only" type="button">route-only</button>
        </main>
        <script>
          const fixtureBaseUrl = 'http://127.0.0.1:65535/__pwcli__/diagnostics';
          const statusEl = document.getElementById('status');
          const runCountEl = document.getElementById('run-count');
          const fireButton = document.getElementById('fire');
          const routeOnlyButton = document.getElementById('route-only');

          let runCount = 0;

          const setStatus = (value) => {
            statusEl.textContent = value;
            runCountEl.textContent = String(runCount);
          };

          const fetchProbe = async (path) => {
            try {
              await fetch(path, {
                cache: 'no-store',
                mode: 'no-cors',
              });
              console.log('fixture-fetch-resolved', path);
            } catch (error) {
              console.error('fixture-fetch-failed', path, String(error));
            }
          };

          const xhrProbe = (path) =>
            new Promise((resolve) => {
              const xhr = new XMLHttpRequest();
              xhr.open('GET', path, true);
              xhr.addEventListener('load', () => {
                console.log('fixture-xhr-load', path, xhr.status);
                resolve();
              });
              xhr.addEventListener('error', () => {
                console.error('fixture-xhr-error', path);
                resolve();
              });
              xhr.addEventListener('abort', () => {
                console.warn('fixture-xhr-abort', path);
                resolve();
              });
              xhr.send();
            });

          const emitPageError = (currentRun) => {
            setTimeout(() => {
              throw new Error('fixture-page-error-run-' + currentRun);
            }, 0);
          };

          const emitRouteTarget = () =>
            fetchProbe(fixtureBaseUrl + '/route-hit?run=' + runCount);

          const emitDiagnostics = async () => {
            runCount += 1;
            const currentRun = runCount;
            setStatus('running-' + currentRun);

            console.log('fixture-log-run-' + currentRun);
            console.warn('fixture-warn-run-' + currentRun);
            console.error('fixture-error-run-' + currentRun);

            void fetchProbe(fixtureBaseUrl + '/fetch?run=' + currentRun);
            void xhrProbe(fixtureBaseUrl + '/xhr?run=' + currentRun);
            void emitRouteTarget();
            emitPageError(currentRun);

            setStatus('done-' + currentRun);
          };

          fireButton.addEventListener('click', () => {
            void emitDiagnostics();
          });

          routeOnlyButton.addEventListener('click', () => {
            runCount += 1;
            setStatus('route-only-' + runCount);
            void emitRouteTarget();
          });

          window.__pwcliDiagnosticsFixture = {
            baseUrl: fixtureBaseUrl,
            emitDiagnostics,
            emitRouteTarget,
          };
        </script>
      </body>
    </html>
  `);

  return 'ready';
}
