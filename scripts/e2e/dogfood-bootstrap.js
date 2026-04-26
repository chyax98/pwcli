async (page) => {
  return await page.evaluate(async () => {
    const fetchResult = await globalThis.__pwcliBootstrapFetch(
      "/api/bootstrap/echo?token=dogfood-fetch",
    );
    const xhrResult = await globalThis.__pwcliBootstrapXhr("/api/bootstrap/echo?token=dogfood-xhr");
    return {
      installed: Boolean(globalThis.__PWCLI_BOOTSTRAP_FIXTURE__?.installed),
      fetchResult,
      xhrResult,
      snapshot: globalThis.__pwcliBootstrapSnapshot(),
    };
  });
}
