async (page) => {
  return await page.evaluate(async () => {
    const response = await fetch("/__pwcli__/diagnostics/json?run=patch-1", {
      cache: "no-store",
    });
    return {
      status: response.status,
      payload: await response.json(),
    };
  });
}
