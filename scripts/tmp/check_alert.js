async page => {
  const el = await page.$('[data-testid="alert-result"]');
  if (!el) return { found: false };
  const text = await el.textContent();
  const html = await page.evaluate(e => e.outerHTML, el);
  return { found: true, text, html };
}
