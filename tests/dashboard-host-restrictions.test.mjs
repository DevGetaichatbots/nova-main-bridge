import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const hostAccessPath = path.join(root, "src/utils/hostAccess.js");
assert.equal(fs.existsSync(hostAccessPath), true, "hostAccess.js should exist");

const hostAccess = read("src/utils/hostAccess.js");
assert.match(hostAccess, /dashboard\.novainsight\.net/, "hostAccess should target the dashboard subdomain");
assert.match(hostAccess, /"\/comparison"/, "hostAccess should allow the comparison dashboard route");
assert.match(hostAccess, /"\/support"/, "hostAccess should allow the support route");
assert.match(hostAccess, /"\/signup"/, "hostAccess should allow signup on the dashboard subdomain");

const app = read("src/App.jsx");
assert.match(app, /RestrictedSubdomainRedirect/, "App should define restricted subdomain redirects");
assert.match(app, /getRestrictedSubdomainHomeRoute/, "App should derive the restricted subdomain landing route");
assert.doesNotMatch(
  app,
  /path="\/signup"[\s\S]*<ProtectedRoute>/,
  "Signup route should not be wrapped in ProtectedRoute",
);

const navbar = read("src/components/Navbar.jsx");
assert.match(navbar, /isRestrictedSubdomain/, "Navbar should detect restricted subdomain mode");
assert.match(navbar, /showComparisonNav/, "Navbar should expose a restricted nav set");
assert.match(navbar, /showFullProductNav/, "Navbar should hide the broader product navigation on the dashboard subdomain");
assert.match(navbar, /showSupportNav/, "Navbar should keep support visible in restricted mode");

const login = read("src/components/Login.jsx");
assert.match(login, /getPostLoginRoute/, "Login should redirect dashboard-host users to the restricted landing route");

const signup = read("src/components/Signup.jsx");
assert.match(signup, /getPostLoginRoute/, "Signup should redirect dashboard-host users to the restricted landing route");

const support = read("src/components/Support.jsx");
assert.match(
  support,
  /https:\/\/n8n\.srv1584222\.hstgr\.cloud\/webhook\/send-support-data/,
  "Support form should post to the updated n8n webhook",
);

const workflow = read(".github/workflows/azure-static-web-apps-green-beach-00b29e810.yml");
assert.match(workflow, /VITE_API_BASE_URL:/, "Static Web App workflow should inject VITE_API_BASE_URL at build time");

console.log("dashboard host restriction smoke checks passed");
