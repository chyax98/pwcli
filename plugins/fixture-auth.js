async (page, args) => {
  const marker = String(args.marker ?? "fixture-auth").trim() || "fixture-auth";
  const path = String(args.path ?? "/").trim() || "/";

  await page.evaluate(
    async ({ nextMarker, cookiePath }) => {
      localStorage.setItem("pwcli-auth-marker", nextMarker);
      document.cookie = `pwcli_auth_marker=${encodeURIComponent(nextMarker)}; path=${cookiePath}`;
      document.body.setAttribute("data-pwcli-auth-marker", nextMarker);
    },
    {
      nextMarker: marker,
      cookiePath: path,
    },
  );

  return {
    ok: true,
    pageState: await page.evaluate(() => ({
      url: window.location.href,
      title: document.title,
      readyState: document.readyState,
      authMarker: localStorage.getItem("pwcli-auth-marker") ?? "",
      bodyMarker: document.body.getAttribute("data-pwcli-auth-marker") ?? "",
    })),
  };
};
