import { getRouteApi } from "@tanstack/react-router";

import type { SiteBootstrap } from "@/lib/types";

const rootApi = getRouteApi("__root__");

export function useSiteBootstrap(): SiteBootstrap {
  return rootApi.useLoaderData() as SiteBootstrap;
}
