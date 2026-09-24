const DASHBOARD_SUBDOMAIN_HOST = "dashboard.novainsight.net";

const RESTRICTED_SUBDOMAIN_ALLOWED_PATHS = new Set([
  "/comparison",
  "/company-signup",
  "/forgot-password",
  "/login",
  "/reset-password",
  "/schedule-analysis",
  "/signup",
  "/support",
  "/verify-otp",
]);

const normalizeHostname = (hostname = "") =>
  hostname.toString().trim().toLowerCase();

export const isRestrictedSubdomain = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return normalizeHostname(window.location.hostname) === DASHBOARD_SUBDOMAIN_HOST;
};

export const isAllowedRestrictedSubdomainPath = (pathname = "") =>
  RESTRICTED_SUBDOMAIN_ALLOWED_PATHS.has(pathname);

export const getRestrictedSubdomainHomeRoute = (isAuthenticated = false) =>
  isAuthenticated ? "/comparison" : "/login";

export const getPostLoginRoute = () => "/comparison";

export const getPostLogoutRoute = () =>
  isRestrictedSubdomain() ? "/login" : "/";

const TENANT_HOST_PATTERN = /^([a-z0-9-]+)\.novainsight\.net$/;
const RESERVED_SUBDOMAINS = new Set([
  "www", "api", "app", "admin", "dashboard", "auth", "login", "mail", "support",
  "help", "docs", "blog", "status", "static", "cdn", "dev", "staging", "test",
]);

export const getTenantSubdomain = () => {
  if (typeof window === "undefined") return null;
  const match = normalizeHostname(window.location.hostname).match(TENANT_HOST_PATTERN);
  return match && !RESERVED_SUBDOMAINS.has(match[1]) ? match[1] : null;
};

// Mirrors backend utils.validators.slugify.
export const slugifySubdomain = (name = "") =>
  name
    .toLowerCase()
    .replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/g, "");

// Full-page redirect only when the target is another host; same host keeps SPA navigation
// (and its "return to where you were" state).
export const crossHostRedirect = (url) => {
  if (!url) return false;
  const target = new URL(url);
  if (target.host === window.location.host) return false;
  window.location.assign(target.href);
  return true;
};
