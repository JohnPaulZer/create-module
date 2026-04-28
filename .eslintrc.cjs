module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    project: null,
  },
  plugins: ["@typescript-eslint", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  rules: {
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "import/extensions": [
      "error",
      "ignorePackages",
      {
        ts: "always",
        tsx: "always",
        js: "always",
        jsx: "always",
        mjs: "always",
      },
    ],
    "import/no-unresolved": "off",
    "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
  },
  settings: {
    "import/resolver": {
      node: {
        extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs"],
      },
    },
  },
};
