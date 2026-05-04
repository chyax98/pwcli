const _lazy = (path: string) => () =>
  import(/* @vite-ignore */ path).then((m: { default: unknown }) => m.default);

export default {
  snapshot: () => import("./snapshot.js").then((m) => m.default),
  "read-text": () => import("./read-text.js").then((m) => m.default),
  text: () => import("./read-text.js").then((m) => m.default),
  status: () => import("./status.js").then((m) => m.default),
  observe: () => import("./status.js").then((m) => m.default),
  screenshot: () => import("./screenshot.js").then((m) => m.default),
  pdf: () => import("./pdf.js").then((m) => m.default),
  accessibility: () => import("./accessibility.js").then((m) => m.default),

  page: () => import("./page.js").then((m) => m.default),
  tab: () => import("./tab.js").then((m) => m.default),

  click: () => import("./click.js").then((m) => m.default),
  fill: () => import("./fill.js").then((m) => m.default),
  type: () => import("./type.js").then((m) => m.default),
  press: () => import("./press.js").then((m) => m.default),
  hover: () => import("./hover.js").then((m) => m.default),
  check: () => import("./check.js").then((m) => m.default),
  uncheck: () => import("./uncheck.js").then((m) => m.default),
  select: () => import("./select.js").then((m) => m.default),
  drag: () => import("./drag.js").then((m) => m.default),
  upload: () => import("./upload.js").then((m) => m.default),
  download: () => import("./download.js").then((m) => m.default),

  scroll: () => import("./scroll.js").then((m) => m.default),
  resize: () => import("./resize.js").then((m) => m.default),
  mouse: () => import("./mouse.js").then((m) => m.default),
  dialog: () => import("./dialog.js").then((m) => m.default),
  open: () => import("./open.js").then((m) => m.default),

  locate: () => import("./locate.js").then((m) => m.default),
  get: () => import("./get.js").then((m) => m.default),
  is: () => import("./is.js").then((m) => m.default),
  verify: () => import("./verify.js").then((m) => m.default),
  wait: () => import("./wait.js").then((m) => m.default),

  console: () => import("./console.js").then((m) => m.default),
  network: () => import("./network.js").then((m) => m.default),
  errors: () => import("./errors.js").then((m) => m.default),
  diagnostics: () => import("./diagnostics.js").then((m) => m.default),
  trace: () => import("./trace.js").then((m) => m.default),
  har: () => import("./har.js").then((m) => m.default),
  route: () => import("./route.js").then((m) => m.default),
  sse: () => import("./sse.js").then((m) => m.default),

  auth: () => import("./auth.js").then((m) => m.default),
  state: () => import("./state.js").then((m) => m.default),
  storage: () => import("./storage.js").then((m) => m.default),
  cookies: () => import("./cookies.js").then((m) => m.default),

  session: () => import("./session.js").then((m) => m.default),

  profile: () => import("./profile.js").then((m) => m.default),
  environment: () => import("./environment.js").then((m) => m.default),
  doctor: () => import("./doctor.js").then((m) => m.default),
  bootstrap: () => import("./bootstrap.js").then((m) => m.default),
  batch: () => import("./batch.js").then((m) => m.default),
  code: () => import("./code.js").then((m) => m.default),
  video: () => import("./video.js").then((m) => m.default),
  skill: () => import("./skill.js").then((m) => m.default),
  dashboard: () => import("./dashboard.js").then((m) => m.default),
} as const;
