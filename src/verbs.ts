import {
  apiGetDocContents,
  apiGetDocsList,
  cloudSave,
  promptUserForRevision,
} from "./cloud.ts";
import { dumpConfig } from "./config.ts";
import {
  die,
  getNumericInput,
  printDocument,
  printHelp,
  promptOrDie,
  promptYn,
  RiteCliConfig,
} from "./utils.ts";

export const VERBS = {
  "push": async function (config: RiteCliConfig) {
    let contents = "";
    const path = promptOrDie(
      "Enter path of file to push: ",
      "You must enter a path.",
    );
    try {
      contents = await Deno.readTextFile(path);
    } catch (e) {
      die("Error reading file: ", e);
    }
    await cloudSave(config, contents);
  },

  "pull": async function (config: RiteCliConfig) {
    const uuid = await promptUserForRevision(config);
    const contents = await apiGetDocContents(config, uuid);
    const path = promptOrDie(
      "Enter filename to save to.",
      "Path cannot be empty.",
    );
    try {
      await Deno.writeTextFile(path, contents);
      console.log(`Saved file to ${path} successfully.`);
    } catch (e) {
      die("Error writing file: ", e);
    }
  },

  "cat": async function (config: RiteCliConfig) {
    const uuid = await promptUserForRevision(config);
    console.log(await apiGetDocContents(config, uuid));
  },

  "help": function (_config: RiteCliConfig) {
    printHelp();
  },

  "list": async function (config: RiteCliConfig) {
    const docs = await apiGetDocsList(config);
    Object.entries(docs).forEach(([name, revisions]) =>
      printDocument(name, revisions)
    );
  },

  "cfg-set": async function (config: RiteCliConfig) {
    delete config.rest;
    const entries = Object.entries(config);
    for (let i = 0; i < entries.length; i++) {
      const idx = i + 1;
      const [key, val] = entries[i];
      console.log(`${idx}. ${key}: ${val}`);
    }

    const idx = getNumericInput(
      `Which value would you like to edit? [1-${entries.length}]`,
      { bounds: [1, entries.length] },
    );
    entries[idx - 1][1] = prompt(
      `Enter new value for "${entries[idx - 1][0]}"`,
    );
    await dumpConfig(Object.fromEntries(entries));
  },

  "cfg-print": function (config: RiteCliConfig) {
    console.log("%cCurrent config:", "color: white; font-weight: bold");
    config["Command line params of current invocation"] = config.rest;
    delete config.rest;
    console.log(config);
  },

  "create": async function (config: RiteCliConfig) {
    let path = prompt(
      "Enter local path to save your file to: [defaults to a temp file if no filename is specified]",
    );
    if (!path) path = await Deno.makeTempFile();

    const editor: string | undefined = config.editor || Deno.env.get("EDITOR");
    if (!editor) console.log('%cWARNING: defaulting to vi since no editor was found in your config file or in the $EDITOR environment variable.', 'color: yellow; font-weight: bold');
    if (
      !promptYn(
        `rite-cli will now attempt to launch your editor with the command '${editor || 'vi'} ${path}'. Is this okay?`,
      )
    ) {
      die("Cancelled.");
    }

    const process = Deno.run({ cmd: [editor || 'vi', path] });
    const status = await process.status();
    if (!status.success) {
      die(
        `Error: editor process exited with code ${status.code}${
          status.signal ? `, signal: ${status.signal}` : ""
        }`,
      );
    }

    if (!promptYn("Your file was saved successfully. Upload it?")) {
      die("Cancelled.");
    }

    await cloudSave(config, await Deno.readTextFile(path));
  },
};
