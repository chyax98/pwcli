async (page) => {
  return await page.evaluate(() => ({
    now: Date.now(),
    iso: new Date(Date.now()).toISOString(),
  }));
}
