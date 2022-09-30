import { getReasonPhrase } from "./deps.ts";
import { RiteCliConfig, API_PATH_T, Rec, AESDecrypt, API_PATHS, die, promptOrDie, groupRevisionsByDoc, getNumericInput } from "./utils.ts";

export async function cloudReq(config: RiteCliConfig, p: API_PATH_T[keyof API_PATH_T], body: Rec = {}) {
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

export async function apiGetDocsList(config: RiteCliConfig): Promise<Record<string, Rec[]>> {
    const [code, resBody] = await cloudReq(config, API_PATHS.LIST_DOCS);
    if (code !== 200) die("Error: ", getReasonPhrase(code));
    return groupRevisionsByDoc(resBody);
}

export async function apiGetDocContents(config: RiteCliConfig, uuid: string) {
    const res = await cloudReq(config, API_PATHS.CONTENTS, { uuid });
    if (res[0] !== 200) die("Error: ", getReasonPhrase(res[0]));

    if (res[1].encrypted) {
        const key = promptOrDie('Document is encrypted. Enter passphrase.', 'Key cannot be empty.');
        res[1].contents = AESDecrypt(res[1].contents, key);
    }

    return res[1].contents;
}

export async function promptUserForDoc(config: RiteCliConfig) {
    const docs = Object.keys(await apiGetDocsList(config));
    let idx = 0;
    console.log('Current documents: \n');
    docs.forEach(itm => {
        idx += 1;
        console.log(`${idx}. ${itm}`);
    })

    let doc = promptOrDie('Enter a number to select one of the above, or type a name to create a new document.');
    if (/\d+/.test(doc)) doc = docs[parseInt(doc)];

    return doc;
}


export async function promptUserForRevision(config: RiteCliConfig) {
    const list = Object.entries(await apiGetDocsList(config));
    const revList = [];
    let idx = 0;
    for (const [key, val] of list) {
        for (const rev of val) {
            idx += 1;
            revList.push([key, rev]);
            console.log(`${idx}. %c${key}%c @ %c${rev.revision}%c${rev.encrypted ? ' (encrypted)' : ''}`,
                "color: green", "", "color: white; font-weight: bold", "color: grey");
        }
    }
    const docIdx = getNumericInput(`Which document would you like to get? [1-${revList.length}]`, { bounds: [1, revList.length] });
    const rev = revList[docIdx - 1][1] as Rec;
    return rev.uuid;
}