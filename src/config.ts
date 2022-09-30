import { dir, path, fs } from "./deps.ts";
import { die, UUID_RE } from "./utils.ts";

export function genConfig() {
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

export function getConfigPath() {
    const configDir = dir("config") as string;
    if (!configDir) die("Error getting config file path.");
    return path.join(configDir, "/rite-cli/config.json");
}

export async function dumpConfig(config: Record<string, string>, p: string = getConfigPath()) {
    await fs.ensureDir(path.dirname(p));
    await Deno.writeTextFile(p, JSON.stringify(config));
}

export async function loadOrCreateConfig() {
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