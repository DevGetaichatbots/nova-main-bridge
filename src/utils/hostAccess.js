const DASHBOARD_SUBDOMAIN_HOST = "dashboard.novainsight.net";

const RESTRICTED_SUBDOMAIN_ALLOWED_PATHS = new Set([
  "/comparison",
  "/forgot-password",
  "/login",
  "/reset-password",
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

export const getPostLoginRoute = () =>
  isRestrictedSubdomain() ? "/comparison" : "/";

export const getPostLogoutRoute = () =>
  isRestrictedSubdomain() ? "/login" : "/";
