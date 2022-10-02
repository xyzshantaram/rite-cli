// deno-lint-ignore-file no-explicit-any
import { CryptoJS } from "./deps.ts";
import { VERBS } from "./verbs.ts";

export interface RiteCliConfig {
    token: string;
    username: string;
    instanceUrl: string;
    rest?: Record<string, any>;
    [key: string]: any;
}

export type API_PATH_T = typeof API_PATHS;
export type Rec = Record<string, any>;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const API_PATHS = {
    LIST_DOCS: "docs/list" as const,
    UPLOAD_DOC: "docs/upload" as const,
    CONTENTS: "docs/contents" as const
}

export function groupRevisionsByDoc(revLs: Rec) {
    return revLs.reduce((group: Record<string, Rec[]>, rev: Rec) => {
        const { name } = rev;
        group[name] ??= [];
        group[name].push(rev);
        return group;
    }, {});
}

export function die(...args: string[]) {
    console.error(...args);
    Deno.exit(1);
}

export function promptOrDie(msg: string, err?: string) {
    return prompt(msg)?.trim() || die(err || 'You must supply an input.') as unknown as string;
}

export function getNumericInput(p: string, rest?: Record<string, any>): number {
    const idx: number = parseInt(promptOrDie(p, "Invalid number supplied."));
    if (rest?.bounds && (idx < rest?.bounds[0] || idx > rest?.bounds[1])) die('Index supplied was out of bounds.');
    return idx;
}

export function promptYn(msg: string) {
    return promptOrDie(`${msg} [y/n]`) === 'y';
}

export const AESDecrypt = (ciphertext: string, passphrase: string) => {
    const bytes = CryptoJS.AES.decrypt(ciphertext, passphrase, {
        format: CryptoJS.format.OpenSSL
    });
    return bytes.toString(CryptoJS.enc.Utf8);
};

export const AESEncrypt = (cleartext: string, passphrase: string) => {
    return CryptoJS.AES.encrypt(cleartext, passphrase).toString(CryptoJS.format.OpenSSL);
}


export function printSingleRevision(itm: Rec) {
    console.log(`%cRevision: "${itm.revision}"`, "font-weight: bold; color: gray");
    console.log(
        `%c(${itm.public ? 'public' : 'private'}, ${itm.encrypted ? 'encrypted' : 'not encrypted'
        })`,
        'font-style: italic');
    console.log(`%cUUID: %c${itm.uuid}\n`, "font-weight: bold", "");
}

export function printDocument(name: string, revisions: Record<string, string>[]) {
    console.log(`DOCUMENT: %c${name}`, "font-weight: bold; color: white");
    revisions.forEach(printSingleRevision);
}

export function printHelp() {
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
