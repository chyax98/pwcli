async (page, args) => {
  if (args.url) {
    await page.goto(args.url);
  } else {
    await page.setContent(`
      <html>
        <head>
          <title>pwcli auth plugin ready</title>
        </head>
        <body>
          <main>
            <h1>Auth Plugin Ready</h1>
            <p id="status">authenticated</p>
          </main>
        </body>
      </html>
    `);
  }

  const pageState = await page.evaluate(() => ({
    url: window.location.href,
    title: document.title,
    readyState: document.readyState,
    heading: document.querySelector("h1")?.textContent ?? "",
    statusText: document.querySelector("#status")?.textContent ?? "",
  }));

  return {
    ok: true,
    pageState,
    note: "example auth plugin completed",
  };
};
