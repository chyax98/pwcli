async page => {
  // Get the source of the browser dialogs section
  const section = await page.$('[data-testid="trigger-alert"]');
  const parent = await page.evaluate(el => el.closest('.space-y-3').innerHTML, section);
  return { parent };
}
