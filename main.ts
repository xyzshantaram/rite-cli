// deno-lint-ignore-file no-explicit-any
import * as flags from "https://deno.land/std@0.156.0/flags/mod.ts";
import * as path from "https://deno.land/std@0.156.0/path/mod.ts";
import * as fs from "https://deno.land/std@0.156.0/fs/mod.ts";
import dir from "https://deno.land/x/dir@1.5.1/mod.ts";
import { getReasonPhrase } from "https://deno.land/x/https_status_codes@v1.2.0/mod.ts";
import CryptoJS from "https://esm.sh/crypto-js@4.1.1";

type Rec = Record<string, any>;

interface RiteCliConfig {
    token: string;
    username: string;
    instanceUrl: string;
    rest?: Record<string, any>;
    [key: string]: any;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const API_PATHS = {
    LIST_DOCS: "docs/list" as const,
    UPLOAD_DOC: "docs/upload" as const,
    CONTENTS: "docs/contents" as const
}

type API_PATH_T = typeof API_PATHS;

async function cloudReq(config: RiteCliConfig, p: API_PATH_T[keyof API_PATH_T], body: Rec = {}) {
    const res = await fetch(`${config.instanceUrl}/api/${p}`, {
        method: "POST",
        body: JSON.stringify({
            token: config.token,
            user: config.username,
            ...body
        })
    });

    return [res.status, await res.json()];
}

function groupRevisionsByDoc(revLs: Rec) {
    return revLs.reduce((group: Record<string, Rec[]>, rev: Rec) => {
        const { name } = rev;
        group[name] ??= [];
        group[name].push(rev);
        return group;
    }, {});
}

function printSingleRevision(itm: Rec) {
    console.log(`%cRevision: "${itm.revision}"`, "font-weight: bold; color: gray");
    console.log(
        `%c(${itm.public ? 'public' : 'private'}, ${itm.encrypted ? 'encrypted' : 'not encrypted'
        })`,
        'font-style: italic');
    console.log(`%cUUID: %c${itm.uuid}\n`, "font-weight: bold", "");
}

function printDocument(name: string, revisions: Record<string, string>[]) {
    console.log(`DOCUMENT: %c${name}`, "font-weight: bold; color: white");
    revisions.forEach(printSingleRevision);
}

async function apiGetDocsList(config: RiteCliConfig): Promise<Record<string, Rec[]>> {
    const [code, resBody] = await cloudReq(config, API_PATHS.LIST_DOCS);
    if (code !== 200) die("Error: ", getReasonPhrase(code));
    return groupRevisionsByDoc(resBody);
}

function getNumericInput(p: string, rest?: Record<string, any>): number {
    const idx: number = parseInt(prompt(p) || '') || die("Invalid number supplied.") as unknown as number;
    if (rest?.bounds && (idx < rest?.bounds[0] || idx > rest?.bounds[1])) die('Index supplied was out of bounds.');
    return idx;
}

async function promptUserForDoc(config: RiteCliConfig) {
    const list = Object.entries(await apiGetDocsList(config));
    const revList = [];
    let idx = 0;
    for (const [key, val] of list) {
        for (const rev of val) {
            idx += 1;
            revList.push([key, rev]);
            console.log(`${idx}. %c${key}%c @ %c${rev.revision}${rev.encrypted ? ' encrypted' : ''}`,
                "color: green", "", "color: white; font-weight: bold");
        }
    }
    const docIdx = getNumericInput(`Which document would you like to get? [1-${revList.length}]`, { bounds: [1, revList.length] });
    const rev = revList[docIdx - 1][1] as Rec;
    return rev.uuid;
}

const AESDecrypt = (ciphertext: string, passphrase: string) => {
    const bytes = CryptoJS.AES.decrypt(ciphertext, passphrase, {
        format: CryptoJS.format.OpenSSL
    });
    return bytes.toString(CryptoJS.enc.Utf8);
};

async function apiGetDocContents(config: RiteCliConfig, uuid: string) {
    const res = await cloudReq(config, API_PATHS.CONTENTS, { uuid });
    if (res[0] !== 200) die("Error: ", getReasonPhrase(res[0]));

    if (res[1].encrypted) {
        const key = prompt('Document is encrypted. Enter passphrase.') || (die('Key cannot be empty.') as unknown as string);
        res[1].contents = AESDecrypt(res[1].contents, key);
    }

    return res[1].contents;
}

const VERBS = {
    "push": function (config: RiteCliConfig) {

    },

    "pull": async function (config: RiteCliConfig) {
        const uuid = await promptUserForDoc(config);
        const contents = await apiGetDocContents(config, uuid);
        const path = prompt('Enter filename to save to.') || (die('Path cannot be empty.') as unknown as string);
        try {
            await Deno.writeTextFile(path, contents);
            console.log(`Saved file to ${path} successfully.`);
        }
        catch (e) {
            die('Error writing file: ', e);
        }
    },

    "cat": async function (config: RiteCliConfig) {
        const uuid = await promptUserForDoc(config);
        const contents = await apiGetDocContents(config, uuid);
        console.log(contents);
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

if (import.meta.main) await main();

function die(...args: string[]) {
    console.error(...args);
    Deno.exit(1);
}

function genConfig() {
    const config = {
        instanceUrl: prompt("Enter the path of your Rite Cloud instance [https://riteapp.co.in by default]")?.trim() || "https://riteapp.co.in",
        username: prompt("Enter your Rite Cloud username")?.trim() as string,
        token: prompt("Enter your Rite Cloud token")?.trim() as string
    };
    if (!config.username) {
        die("You must enter a username.");
    }

    if (!config.token || !UUID_RE.test(config.token)) {
        die("You must enter a valid Rite Cloud token.");
    }

    return config;

}

function getConfigPath() {
    const configDir = dir("config") as string;
    if (!configDir) die("Error getting config file path.");
    return path.join(configDir, "/rite-cli/config.json");
}

async function dumpConfig(config: Record<string, string>, p: string = getConfigPath()) {
    await fs.ensureDir(path.dirname(p));
    await Deno.writeTextFile(p, JSON.stringify(config));
}

async function loadOrCreateConfig() {
    const configPath = getConfigPath();
    try {
        const configContents = await Deno.readTextFile(configPath);
        return JSON.parse(configContents);
    }
    catch (e) {
        if (e instanceof Deno.errors.NotFound) {
            console.log(`%cConfig file not found at "${configPath}". It will be created.`, "color: yellow; font-weight: bold");
            const config = genConfig();
            await dumpConfig(config, configPath);
            return config;
        }
        else {
            console.error(e);
            die('Unhandled exception.');
        }
    }
}

function printHelp() {
    console.log(`\
Usage:
	rite-cli VERB [OPTIONS]
	where VERB={${Object.keys(VERBS).join(", ")}}

Verbs:

	list: Lists all revisions of a specific or all documents.
	push: Pushes a file to the cloud.
	pull: Gets a file from the cloud and saves it locally.
	cat: Gets a file from the cloud and displays its contents.
	cfg-set: Change the value of a configuration parameter.
	cfg-print: Print the current configuration.
	create: Edit a file and push it to the cloud.
	help: display this help.
`);
}

async function main() {
    const args = flags.parse(Deno.args);

    const verb = args._[0] as string;

    if (!verb) {
        die('Error: You must specify a verb.');
    }

    if (!Object.keys(VERBS).includes(verb)) {
        die(`Error: unknown verb ${verb}. See \`rite-cli help\` for help.`);
    }

    const config: RiteCliConfig = await loadOrCreateConfig();
    config.rest = args;
    await VERBS[verb as keyof typeof VERBS](config);

    Deno.exit(0);
}
