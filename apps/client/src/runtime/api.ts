import { createApiTransport } from "@finpill/contracts";

import { publicEnvironment } from "@/config/environment";

import type { ClientPlatform } from "@finpill/contracts";

export function createClientApi(platform: ClientPlatform) {
  const origin = publicEnvironment.NEXT_PUBLIC_API_ORIGIN;
  if (!publicEnvironment.NEXT_PUBLIC_API_ENABLED || !origin) {
    return undefined;
  }

  return createApiTransport({
    origin,
    auth: platform.auth,
  });
}
