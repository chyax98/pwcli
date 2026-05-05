import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import {
  managedEnvironmentClockInstall,
  managedEnvironmentClockResume,
  managedEnvironmentClockSet,
  managedEnvironmentGeolocationSet,
  managedEnvironmentOffline,
  managedEnvironmentPermissionsClear,
  managedEnvironmentPermissionsGrant,
} from "#engine/environment.js";
import {
  managedAllowedDomainsClear,
  managedAllowedDomainsSet,
  managedAllowedDomainsStatus,
} from "#engine/session.js";
import { assertSessionAutomationControl } from "#store/control-state.js";
import {
  type CliArgs,
  firstPos,
  num,
  positionals,
  print,
  session,
  str,
  withCliError,
} from "./_helpers.js";

const offline = defineCommand({
  meta: {
    name: "offline",
    description:
      "Purpose: set network offline mode for a session.\nExamples:\n  pw environment offline -s task-a on\n  pw environment offline -s task-a off\nNotes: verify network-dependent page behavior after changing this state.",
  },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      await assertSessionAutomationControl(session(a), "environment offline");
      print(
        "environment offline",
        await managedEnvironmentOffline(firstPos(a) as "on" | "off", { sessionName: session(a) }),
        a,
      );
    } catch (e) {
      withCliError("environment offline", a, e);
    }
  },
});
const geoSet = defineCommand({
  meta: {
    name: "set",
    description:
      "Purpose: set browser geolocation for the target session.\nOptions: --lat and --lng are required; --accuracy is optional.\nExamples:\n  pw environment permissions grant -s geo-a geolocation\n  pw environment geolocation set -s geo-a --lat 31.2304 --lng 121.4737 --accuracy 20\nNotes: grant geolocation permissions before testing sites that call navigator.geolocation.",
  },
  args: {
    ...sharedArgs,
    lat: { type: "string", description: "Latitude", valueHint: "lat" },
    lng: { type: "string", description: "Longitude", valueHint: "lng" },
    accuracy: { type: "string", description: "Accuracy meters", valueHint: "m" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      await assertSessionAutomationControl(session(a), "environment geolocation set");
      const latitude = num(str(a.lat));
      const longitude = num(str(a.lng));
      if (latitude === undefined || longitude === undefined) {
        throw new Error("environment geolocation set requires --lat <lat> --lng <lng>");
      }
      print(
        "environment geolocation set",
        await managedEnvironmentGeolocationSet({
          sessionName: session(a),
          latitude,
          longitude,
          accuracy: num(a.accuracy),
        }),
        a,
      );
    } catch (e) {
      withCliError("environment geolocation set", a, e);
    }
  },
});
const permGrant = defineCommand({
  meta: {
    name: "grant",
    description:
      "Purpose: grant browser permissions to the session.\nExamples:\n  pw environment permissions grant -s task-a geolocation notifications\nNotes: grant only the permissions required by the scenario.",
  },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      await assertSessionAutomationControl(session(a), "environment permissions grant");
      print(
        "environment permissions grant",
        await managedEnvironmentPermissionsGrant({
          sessionName: session(a),
          permissions: positionals(a),
        }),
        a,
      );
    } catch (e) {
      withCliError("environment permissions grant", a, e);
    }
  },
});
const permClear = defineCommand({
  meta: {
    name: "clear",
    description:
      "Purpose: clear granted permissions for the session.\nExamples:\n  pw environment permissions clear -s task-a\nNotes: use this to reset permission-sensitive tests.",
  },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      await assertSessionAutomationControl(session(a), "environment permissions clear");
      print(
        "environment permissions clear",
        await managedEnvironmentPermissionsClear({ sessionName: session(a) }),
        a,
      );
    } catch (e) {
      withCliError("environment permissions clear", a, e);
    }
  },
});
const clockInstall = defineCommand({
  meta: {
    name: "install",
    description:
      "Purpose: install Playwright clock control in the page.\nExamples:\n  pw environment clock install -s task-a\nNotes: install before setting or advancing deterministic time.",
  },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      await assertSessionAutomationControl(session(a), "environment clock install");
      print(
        "environment clock install",
        await managedEnvironmentClockInstall({ sessionName: session(a) }),
        a,
      );
    } catch (e) {
      withCliError("environment clock install", a, e);
    }
  },
});
const clockSet = defineCommand({
  meta: {
    name: "set",
    description:
      "Purpose: set the controlled clock time.\nExamples:\n  pw environment clock set -s task-a 2026-01-01T00:00:00.000Z\nNotes: call `clock install` first when the page needs deterministic time.",
  },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      await assertSessionAutomationControl(session(a), "environment clock set");
      print(
        "environment clock set",
        await managedEnvironmentClockSet(new Date(firstPos(a) as string).toISOString(), {
          sessionName: session(a),
        }),
        a,
      );
    } catch (e) {
      withCliError("environment clock set", a, e);
    }
  },
});
const clockResume = defineCommand({
  meta: {
    name: "resume",
    description:
      "Purpose: resume normal clock behavior after clock control.\nExamples:\n  pw environment clock resume -s task-a\nNotes: use this when deterministic time is no longer needed.",
  },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      await assertSessionAutomationControl(session(a), "environment clock resume");
      print(
        "environment clock resume",
        await managedEnvironmentClockResume({ sessionName: session(a) }),
        a,
      );
    } catch (e) {
      withCliError("environment clock resume", a, e);
    }
  },
});

const domainsSet = defineCommand({
  meta: {
    name: "set",
    description:
      "Purpose: store the allowed navigation domains for this session.\nOptions: pass one or more domain patterns like example.com or *.example.com.\nExamples:\n  pw environment allowed-domains set -s bug-a example.com *.example.com\nScope: guards `pw open` navigation against non-allowed hosts.",
  },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      await assertSessionAutomationControl(session(a), "environment allowed-domains set");
      print(
        "environment allowed-domains set",
        await managedAllowedDomainsSet({
          sessionName: session(a),
          domains: positionals(a),
        }),
        a,
      );
    } catch (e) {
      withCliError("environment allowed-domains set", a, e);
    }
  },
});

const domainsStatus = defineCommand({
  meta: {
    name: "status",
    description:
      "Purpose: show current allowed navigation domains for the session.\nExamples:\n  pw environment allowed-domains status -s task-a\nNotes: this is read-only and reports the `pw open` navigation allowlist.",
  },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print(
        "environment allowed-domains status",
        await managedAllowedDomainsStatus({ sessionName: session(a) }),
        a,
      );
    } catch (e) {
      withCliError("environment allowed-domains status", a, e);
    }
  },
});

const domainsClear = defineCommand({
  meta: {
    name: "clear",
    description:
      "Purpose: clear session allowed navigation domains.\nExamples:\n  pw environment allowed-domains clear -s task-a\nNotes: clearing removes the `pw open` navigation allowlist for the session.",
  },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      await assertSessionAutomationControl(session(a), "environment allowed-domains clear");
      print(
        "environment allowed-domains clear",
        await managedAllowedDomainsClear({ sessionName: session(a) }),
        a,
      );
    } catch (e) {
      withCliError("environment allowed-domains clear", a, e);
    }
  },
});

export default defineCommand({
  meta: {
    name: "environment",
    description:
      "Purpose: control session environment such as network, geolocation, permissions, clock and allowed navigation domains.\nExamples:\n  pw environment offline -s task-a on\n  pw environment geolocation set -s task-a --lat 31.2 --lng 121.5\nNotes: environment commands mutate the session and should be followed by page facts or diagnostics.",
  },
  subCommands: {
    offline,
    geolocation: defineCommand({
      meta: { name: "geolocation", description: "Geolocation controls" },
      subCommands: { set: geoSet },
    }),
    permissions: defineCommand({
      meta: {
        name: "permissions",
        description:
          "Purpose: grant or clear browser permissions for a session.\nExamples:\n  pw environment permissions grant -s task-a geolocation\nNotes: permission commands mutate the session.",
      },
      subCommands: { grant: permGrant, clear: permClear },
    }),
    clock: defineCommand({
      meta: {
        name: "clock",
        description:
          "Purpose: install, set, or resume deterministic page clock control.\nExamples:\n  pw environment clock install -s task-a\n  pw environment clock set -s task-a 2026-01-01T00:00:00.000Z\nNotes: use clock controls for time-dependent flows.",
      },
      subCommands: { install: clockInstall, set: clockSet, resume: clockResume },
    }),
    "allowed-domains": defineCommand({
      meta: { name: "allowed-domains", description: "Allowed navigation domains" },
      subCommands: { set: domainsSet, status: domainsStatus, clear: domainsClear },
    }),
  },
});
