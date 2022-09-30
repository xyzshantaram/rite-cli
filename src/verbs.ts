import { promptUserForDoc, cloudReq, promptUserForRevision, apiGetDocContents, apiGetDocsList } from "./cloud.ts";
import { dumpConfig } from "./config.ts";
import { getReasonPhrase } from "./deps.ts";
import { RiteCliConfig, promptOrDie, die, AESEncrypt, API_PATHS, printHelp, printDocument, getNumericInput } from "./utils.ts";

export const VERBS = {
    "push": async function (config: RiteCliConfig) {
        let contents = '';
        const path = promptOrDie('Enter path of file to push: ', 'You must enter a path.');
        try {
            contents = await Deno.readTextFile(path);
        }
        catch (e) {
            die("Error reading file: ", e);
        }

        const name = await promptUserForDoc(config);
        const revision = promptOrDie('Enter revision name: ');
        const pub = promptOrDie('Should this document be public? [y/n]') === 'y';
        const passphrase = prompt('Enter password for encryption (leave blank to skip)');
        let encrypted = false;
        if (passphrase?.trim()) {
            encrypted = true;
            contents = AESEncrypt(contents, passphrase.trim());
        }

        const res = await cloudReq(config, API_PATHS.UPLOAD_DOC, {
            name, revision, public: pub, encrypted, contents
        });

        if (res[0] !== 200) {
            die(`Error while communicating with rite-cloud: ${res[1].message} (${getReasonPhrase(res[0])})`);
        }

        console.log("Uploaded successfully.");
        console.log("UUID:", res[1].uuid);
        console.log("View doc at:", `${config.instanceUrl}/docs/view/${res[1].uuid}`);
    },

    "pull": async function (config: RiteCliConfig) {
        const uuid = await promptUserForRevision(config);
        const contents = await apiGetDocContents(config, uuid);
        const path = promptOrDie('Enter filename to save to.', 'Path cannot be empty.');
        try {
            await Deno.writeTextFile(path, contents);
            console.log(`Saved file to ${path} successfully.`);
        }
        catch (e) {
            die('Error writing file: ', e);
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
        Object.entries(docs).forEach(([name, revisions]) => printDocument(name, revisions));
    },

    "cfg-set": async function (config: RiteCliConfig) {
        delete config.rest;
        const entries = Object.entries(config);
        for (let i = 0; i < entries.length; i++) {
            const idx = i + 1;
            const [key, val] = entries[i];
            console.log(`${idx}. ${key}: ${val}`);
        }

        const idx = getNumericInput(`Which value would you like to edit? [1-${entries.length}]`, { bounds: [1, entries.length] });
        entries[idx - 1][1] = prompt(`Enter new value for "${entries[idx - 1][0]}"`);
        await dumpConfig(Object.fromEntries(entries));
    },

    "cfg-print": function (config: RiteCliConfig) {
        console.log("%cCurrent config:", "color: white; font-weight: bold");
        config["Command line params of current invocation"] = config.rest;
        delete config.rest;
        console.log(config);
    },

    "create": async function (_config: RiteCliConfig) {
        let path = prompt("Enter local path to save your file to: [defaults to a temp file if no filename is specified]");
        if (!path) path = await Deno.makeTempFile();
    }
}