import baseConfigYaml from "../../config/base.yml";
import developmentConfigYaml from "../../config/development.yml";
import releaseConfigYaml from "../../config/release.yml";
import type { DeepPartial, GameConfig } from "./types";

const modeConfig: Record<string, unknown> = {
  development: developmentConfigYaml,
  production: releaseConfigYaml,
  release: releaseConfigYaml,
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
    merged[key] = isPlainObject(baseValue) && isPlainObject(value) ? mergeConfig(baseValue, value) : value;
  }

  return merged as T;
};

const baseConfig = baseConfigYaml as GameConfig;
const overrideConfig = (modeConfig[import.meta.env.MODE] ?? {}) as DeepPartial<GameConfig>;

export const gameConfig = mergeConfig(baseConfig, overrideConfig);
