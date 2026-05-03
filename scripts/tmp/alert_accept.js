async page => {
  // Register dialog handler BEFORE clicking to avoid race condition
  let dialogHandled = false;
  let dialogInfo = {};

  page.on('dialog', async (dialog) => {
    if (!dialogHandled) {
      dialogHandled = true;
      dialogInfo = { type: dialog.type(), message: dialog.message() };
      await dialog.accept();
    }
  });

  // Click the alert trigger button
  await page.getByTestId('trigger-alert').click();

  // Wait for dialog handling and UI update
  await page.waitForTimeout(1500);

  // Read alert result
  const alertResultEl = page.getByTestId('alert-result');
  let alertResult = '';
  try {
    alertResult = await alertResultEl.textContent({ timeout: 3000 });
  } catch (e) {
    alertResult = 'element not found';
  }

  return { dialogHandled, dialogInfo, alertResult };
}
