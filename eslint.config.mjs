import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    // Global ignores: keep ESLint focused on source code.
    // These paths contain generated bundles, reports, backups, or vendored/minified assets.
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/out/**",
      "**/build/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "**/screenshots/**",
      "**/venv/**",
      "**/*.min.js",
      "**/*.map",
      "**/*.html",
      "next-env.d.ts",
      "scripts/**",
      "types/supabase.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
];

export default eslintConfig;