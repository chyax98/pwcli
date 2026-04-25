async (page, args) => {
  if (args.url) {
    await page.goto(args.url);
  }

  return {
    ok: true,
    page: {
      url: page.url(),
      title: await page.title().catch(() => ''),
    },
    note: 'example auth plugin completed',
  };
}
