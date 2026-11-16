import { Configuration } from "@monkeytype/schemas/configuration";
import { promiseWithResolvers } from "../utils/misc";
import { queryClient } from "../queries";
import { getServerConfigurationQueryOptions } from "../queries/server-configuration";

const { promise: configurationPromise, resolve } =
  promiseWithResolvers<boolean>();

// kiosk: no backend. resolve right away so nothing waits forever;
// get() then returns undefined and callers use their fallbacks
resolve(true);

export { configurationPromise };

export function get(): Configuration | undefined {
  return queryClient.getQueryData(
    getServerConfigurationQueryOptions().queryKey,
  );
}

export async function sync(): Promise<void> {
  // kiosk: no request to the backend (configurationPromise is already resolved)
}
