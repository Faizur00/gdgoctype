import { Config } from "@monkeytype/schemas/configs";

// kiosk: values fixed for the whole app (must match default-config.ts)
const LOCKED_CONFIG: Partial<Config> = {
  theme: "gdgoc",
  mode: "time",
  time: 60,
  language: "english",
  punctuation: false,
  numbers: false,
  funbox: [],
  ads: "off",
};

/** true if setting `key` to `value` would break the lock */
export function violatesLockedConfig(key: string, value: unknown): boolean {
  if (!Object.hasOwn(LOCKED_CONFIG, key)) return false;
  return (
    JSON.stringify(LOCKED_CONFIG[key as keyof Config]) !==
    JSON.stringify(value)
  );
}

/** overwrites locked keys, used when loading stored config */
export function applyLockedConfig(config: Config): Config {
  return { ...config, ...LOCKED_CONFIG };
}
