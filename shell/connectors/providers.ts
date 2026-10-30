import type { ScanProviders } from "../../engine/types.ts";
import { fetchNpmPackage } from "./npm-registry.ts";
import { fetchAdvisories } from "./osv-dev.ts";

export function buildLiveProviders(): ScanProviders {
  return {
    async getNpmPackage(name) {
      const fetched = await fetchNpmPackage(name, new Date().toISOString());
      return { data: fetched.data, snapshot: fetched.snapshot };
    },
    async getAdvisories(name) {
      const fetched = await fetchAdvisories(name, new Date().toISOString());
      return fetched;
    }
  };
}
