// deno-lint-ignore-file no-explicit-any
import * as flags from "https://deno.land/std@0.156.0/flags/mod.ts";
import * as path from "https://deno.land/std@0.156.0/path/mod.ts";
import * as fs from "https://deno.land/std@0.156.0/fs/mod.ts";
import dir from "https://deno.land/x/dir@1.5.1/mod.ts";
import { getReasonPhrase } from "https://deno.land/x/https_status_codes@v1.2.0/mod.ts";

type Rec = Record<string, any>;

interface RiteCliConfig {
	token: string;
	username: string;
	instanceUrl: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const API_PATHS = {
	LIST_DOCS: "docs/list" as const,
	UPLOAD_DOC: "docs/upload" as const,
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
		`%c(${ itm.public ? 'public' : 'private' }, ${
			itm.encrypted ? 'encrypted' : 'not encrypted'
		})`, 
		'font-style: italic');
	console.log(`%cUUID: %c${itm.uuid}\n`, "font-weight: bold", "");
}

function printDocument(name: string, revisions: Record<string, string>[]) {
	console.log(`DOCUMENT: %c${name}`, "font-weight: bold; color: white");
	revisions.forEach(printSingleRevision);
}

const VERBS = {
	"push": function(config: RiteCliConfig) {
		
	},
	"pull": function(config: RiteCliConfig) {
		
	},
	"cat": function(config: RiteCliConfig) {
		
	},
	"help": function(config: RiteCliConfig) {
		printHelp();
	},
	"list": async function(config: RiteCliConfig) {
		const [code, resBody] = await cloudReq(config, API_PATHS.LIST_DOCS);
		if (code !== 200) {
		    die("Error: ", getReasonPhrase(code));
		}
		
		const docs: Record<string, Rec[]> = groupRevisionsByDoc(resBody);		
		Object.entries(docs).forEach(([name, revisions]) => printDocument(name, revisions));
	},
	
	"cfg-set": function(config: RiteCliConfig) {
	},
	
	"cfg-print": function(config: RiteCliConfig) {
		console.log(config);
	},

	"edit": {
		
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
	
	if (!await fs.exists(configPath)) {
		const config = genConfig();
		await dumpConfig(config, configPath);
		return config;
	}
	
	return JSON.parse(await Deno.readTextFile(configPath));
}

function printHelp() {
	console.log(`\
Usage:
\trite-cli VERB [OPTIONS]
\twhere VERB={${Object.keys(VERBS).join(",")}}

Verbs: [see \`rite-cli help VERB\` for detailed help]

\tlist: Lists all revisions of a specific or all documents.
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

	const config = await loadOrCreateConfig();
	await VERBS[verb as keyof typeof VERBS](config);

	Deno.exit(0);
}
