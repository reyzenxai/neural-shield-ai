import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Cosmetic rule (it wants &quot; instead of a literal "). It never affects
      // behavior and is commonly turned off in Next apps. The privacy and terms
      // pages carry legal copy with real quotation marks.
      "react/no-unescaped-entities": "off",
      // React 19's new rule flags the standard "read or fetch on mount" effect
      // used by the admin pages and the cookie banner, which is intentional here.
      // Kept as a warning so it stays visible without failing the build. Flip
      // this back to "error" and refactor the effects if you want it strict.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
