async page => {
  // Set up dialog handler to accept alert
  const dialogPromise = new Promise((resolve) => {
    page.once('dialog', async (dialog) => {
      const message = dialog.message();
      const type = dialog.type();
      await dialog.accept();
      resolve({ type, message });
    });
  });

  // Click the alert button
  await page.getByTestId('trigger-alert').click();

  // Wait for dialog to be handled
  const dialogInfo = await dialogPromise;

  // Wait for result to update
  await page.waitForTimeout(1000);

  // Read the alert result text
  const alertResult = await page.getByTestId('alert-result').textContent();

  return { dialogInfo, alertResult };
}
