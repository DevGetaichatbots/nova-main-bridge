// Explicit .js extensions: the node test runner imports this file directly (Vite accepts both).
import axios from "axios";
import { getApiBaseUrl } from "./apiConfig.js";
import { getTenantSubdomain } from "./hostAccess.js";

export const TENANT_HEADER = "X-Company-Subdomain";

const requestUrl = (input) =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input?.url ?? "";

// Tags every API call with the tenant from the current host. The backend only uses it to
// validate context; a call that misses it falls back to the user's own company.
export const installTenantHeaders = (sub = getTenantSubdomain(), base = getApiBaseUrl()) => {
  if (!sub) return;
  axios.defaults.headers.common[TENANT_HEADER] = sub;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    if (!requestUrl(input).startsWith(base)) return nativeFetch(input, init);
    const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set(TENANT_HEADER, sub);
    return nativeFetch(input, { ...init, headers });
  };
};
