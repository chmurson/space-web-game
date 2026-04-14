import type { DeepPartial, GameConfig } from "./types";

const configModules = import.meta.glob("../../config/*.yml", {
	eager: true,
	import: "default",
}) as Record<string, unknown>;

const modeConfigName: Record<string, string> = {
	development: "development",
	production: "release",
	release: "release",
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const mergeConfig = <T>(base: T, override: DeepPartial<T>): T => {
	if (!isPlainObject(base) || !isPlainObject(override)) {
		return override === undefined ? base : (override as T);
	}

	const merged: Record<string, unknown> = { ...base };

	for (const [key, value] of Object.entries(override)) {
		const baseValue = (base as Record<string, unknown>)[key];
		merged[key] =
			isPlainObject(baseValue) && isPlainObject(value)
				? mergeConfig(baseValue, value)
				: value;
	}

	return merged as T;
};

const getConfigModule = (name: string): DeepPartial<GameConfig> =>
	(configModules[`../../config/${name}.yml`] ?? {}) as DeepPartial<GameConfig>;

const resolveGameConfig = (mode: string): GameConfig => {
	const resolvedMode = modeConfigName[mode];
	const baseConfig = getConfigModule("base") as GameConfig;
	const configChain: DeepPartial<GameConfig>[] = [
		getConfigModule("base.local"),
	];

	if (resolvedMode) {
		configChain.push(
			getConfigModule(resolvedMode),
			getConfigModule(`${resolvedMode}.local`),
		);
	}

	let mergedConfig = baseConfig;

	for (const override of configChain) {
		mergedConfig = mergeConfig(mergedConfig, override);
	}

	return mergedConfig;
};

export const gameConfig = resolveGameConfig(import.meta.env.MODE);
