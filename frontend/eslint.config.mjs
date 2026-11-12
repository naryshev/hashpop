import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

// Flat config replacing .eslintrc.json ("extends": ["next/core-web-vitals"]).
// Next 16 removed `next lint`; `npm run lint` now runs the ESLint CLI.
export default defineConfig([
  ...nextCoreWebVitals,
  {
    // eslint-plugin-react-hooks 7 (pulled in by eslint-config-next 16) adds
    // React Compiler rules that were not part of the Next 14 lint set. They
    // flag ~110 existing patterns (setState in effects, ref reads in render)
    // that work today. Keep the pre-upgrade rule set (rules-of-hooks and
    // exhaustive-deps stay on) and adopt these in a separate change.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/purity": "off",
      "react-hooks/static-components": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "node_modules/**"]),
]);
