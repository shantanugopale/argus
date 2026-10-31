import type { ScanProviders } from "../../engine/types.ts";
import { fetchNpmPackage } from "./npm-registry.ts";
import { fetchAdvisories } from "./osv-dev.ts";
import { fetchGithubRepo, fetchTrendingToday } from "./github-api.ts";

export function buildLiveProviders(): ScanProviders {
  return {
    async getNpmPackage(name, opts) {
      const fetched = await fetchNpmPackage(name, new Date().toISOString(), { includeMonth: opts?.includeMonth !== false });
      return { data: fetched.data, snapshot: fetched.snapshot };
    },
    async getAdvisories(name) {
      const fetched = await fetchAdvisories(name, new Date().toISOString());
      return fetched;
    },
    async getGithubRepo(fullName) {
      const fetched = await fetchGithubRepo(fullName, new Date().toISOString());
      return { data: fetched.data, snapshot: fetched.snapshot };
    },
    async getTrendingToday() {
      return fetchTrendingToday(new Date().toISOString());
    }
  };
}
