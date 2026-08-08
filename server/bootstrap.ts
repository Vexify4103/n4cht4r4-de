import * as nextEnv from "@next/env";

const envModule = nextEnv as typeof nextEnv & { default?: typeof nextEnv };
const loadEnvConfig = nextEnv.loadEnvConfig || envModule.default?.loadEnvConfig;
if (!loadEnvConfig) throw new Error("@next/env could not be initialized.");
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
void import("./server").catch((error) => {
	console.error("N4cht4r4 server failed to start:", error);
	process.exit(1);
});
