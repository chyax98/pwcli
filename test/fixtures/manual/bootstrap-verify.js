async (page) => {
  return await page.evaluate(async () => {
    const fetchResult = await globalThis.__pwcliBootstrapFetch(
      "/__pwcli__/bootstrap/echo?token=fetch-1",
    );
    const xhrResult = await globalThis.__pwcliBootstrapXhr("/__pwcli__/bootstrap/echo?token=xhr-1");

    return {
      installed: Boolean(globalThis.__PWCLI_BOOTSTRAP_FIXTURE__?.installed),
      fetchResult,
      xhrResult,
      snapshot: globalThis.__pwcliBootstrapSnapshot(),
    };
  });
}
