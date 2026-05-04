// biome-ignore format: pw code --file expects a raw function expression without a trailing semicolon.
async (page) => {
  return await page.evaluate(() => ({
    now: Date.now(),
    iso: new Date(Date.now()).toISOString(),
  }));
}
