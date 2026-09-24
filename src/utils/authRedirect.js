const DEFAULT_POST_AUTH_ROUTE = "/comparison";

const ALLOWED_POST_AUTH_ROUTES = new Set([
  "/comparison",
  "/chat",
  "/schedule-analysis",
]);

export const buildLoginState = (planId) => ({
  from: DEFAULT_POST_AUTH_ROUTE,
  ...(planId ? { planId } : {}),
});

export const resolvePostAuthRoute = (state) => {
  const destination = state?.from;

  if (typeof destination !== "string") {
    return DEFAULT_POST_AUTH_ROUTE;
  }

  const [pathname] = destination.split(/[?#]/, 1);
  return ALLOWED_POST_AUTH_ROUTES.has(pathname)
    ? destination
    : DEFAULT_POST_AUTH_ROUTE;
};

export const buildPostAuthNavigation = (state) => ({
  to: resolvePostAuthRoute(state),
  ...(typeof state?.planId === "string" && state.planId
    ? { state: { planId: state.planId } }
    : {}),
});

export { DEFAULT_POST_AUTH_ROUTE };
