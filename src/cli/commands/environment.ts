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
  meta: { name: "offline", description: "Set network offline mode" },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
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
  meta: { name: "grant", description: "Grant permissions" },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
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
  meta: { name: "clear", description: "Clear permissions" },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
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
  meta: { name: "install", description: "Install fake clock" },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
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
  meta: { name: "set", description: "Set fake clock time" },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
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
  meta: { name: "resume", description: "Resume clock" },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
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

export default defineCommand({
  meta: { name: "environment", description: "Environment and clock controls" },
  subCommands: {
    offline,
    geolocation: defineCommand({
      meta: { name: "geolocation", description: "Geolocation controls" },
      subCommands: { set: geoSet },
    }),
    permissions: defineCommand({
      meta: { name: "permissions", description: "Permission controls" },
      subCommands: { grant: permGrant, clear: permClear },
    }),
    clock: defineCommand({
      meta: { name: "clock", description: "Clock controls" },
      subCommands: { install: clockInstall, set: clockSet, resume: clockResume },
    }),
  },
});
