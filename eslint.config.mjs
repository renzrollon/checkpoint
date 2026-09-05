import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // eslint-plugin-react's auto-detection calls context.getFilename(), which
    // ESLint 10 removed; pinning the version skips that path.
    settings: {
      react: {
        version: "19.2.8",
      },
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "playwright-report/**",
      "test-results/**",
      "openspec/**",
    ],
  },
];

export default eslintConfig;
