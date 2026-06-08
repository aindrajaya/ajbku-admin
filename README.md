# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

  ## Git Commit Plan

  This section contains the Git commit plan for making focused, reviewable commits from this repository.

  ### Overview
  - Goal: produce focused, reviewable commits grouped by logical change.
  - Branching: create a feature branch for your work, e.g. `feature/<short-name>`.

  ### Steps

  1. Review changes
    - Inspect `git status` and `git diff` to group related edits.
    - Decide logical groups: features, bugfixes, refactors, style/lint.

  2. Run tests & linters
    - Run project checks and fix failing tests or lint issues before committing.
    - Example commands:

  ```powershell
  npm ci
  npm test
  npm run lint
  ```

  3. Stage feature changes (only)
    - Stage only files that belong to the main feature or user-facing change.
    - Example:

  ```powershell
  git add src/views/Dashboard.tsx src/components/SomeWidget.tsx
  ```

  4. Commit feature changes
    - Commit with a clear `feat:` message.
    - Template: `feat(<scope>): short description`.
    - Example: `feat(dashboard): add recent-activity widget`

  5. Stage fixups & formatting
    - Stage remaining unrelated changes like formatting, lint fixes, small refactors.
    - Example: `git add .` if only formatting remains, or add specific files.

  6. Commit fixups
    - Use `chore:` or `fix:` depending on intent.
    - Examples:
      - `chore: format files with Prettier`
      - `fix: resolve lint errors in Dashboard view`

  7. Update docs / changelog
    - Add or update documentation files describing the feature.
    - Commit with `docs:` message. Example: `docs: add dashboard widget usage`

  8. Final smoke test
    - Run the app locally and perform basic verification.

  9. Push branch and open PR
    - Push your feature branch: `git push -u origin feature/<short-name>`
    - Open a PR with description, testing notes, and a brief list of changed files.

  ### Commit message prefixes
  - `feat:` — new features or user-visible changes
  - `fix:` — bug fixes
  - `refactor:` — code changes without behaviour change
  - `chore:` — tooling, build, format changes
  - `docs:` — documentation updates
  - `test:` — adding or fixing tests

  ### Example workflow

  ```powershell
  git checkout -b feature/add-recent-widget
  # stage only feature files
  git add src/views/Dashboard.tsx src/components/RecentWidget.tsx
  git commit -m "feat(dashboard): add recent-activity widget"
  # stage and commit formatting/lint fixes
  git add src/**/*.ts* package.json
  git commit -m "chore: format and fix lint issues"
  git push -u origin feature/add-recent-widget
  ```

  ### PR checklist (suggested)
  - Title follows `feat|fix(scope): short summary` format
  - Summary explains why the change was made
  - Tests or manual verification steps included
  - Any required migration or config steps documented
  - Assign reviewers

  ---
  End of Git commit plan.
