import { loadOrCreateConfig } from "./config.ts";
import { flags } from "./deps.ts";
import { die, RiteCliConfig } from "./utils.ts";
import { VERBS } from "./verbs.ts";

if (import.meta.main) await main();

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