# CLAUDE.md: Taxa pe stat

Instructions for Claude Code. Read them at the start of every session in this repo.

## The project, briefly

A calculator, in Romanian: how much money kept in lei loses to inflation and to the EUR/USD exchange rate, per day, week, month and year.
- **The page** is in `src/`: the markup, two stylesheets and small ES modules, with no dependencies. `build.mjs` joins them into one page.
- **The data** (BNR, Eurostat) is updated daily by GitHub Actions.
- **The site** is on GitHub Pages: https://romulusmirauta.github.io/taxa-pe-stat/

Where to find the rest:

| File | What it holds |
|---|---|
| `README.md` | for visitors, in Romanian: what the app does, the commands |
| `DESIGN.md` | the formulas (§5), the data sources (§2), the decisions, the next steps (§11) |
| `FINDINGS.md` | the bug registry: what is fixed and what is still in the app |
| `CHANGELOG.md` | the versions |
| `docs/DEVELOPMENT.md` | how we work: Claude, the local copy, the former claude.ai artifact |
| `docs/IDEAS.md` | ideas for later, not scheduled |

## Where we left off (29 Oct 2026)

- **Published:** v0.3.4, on GitHub Pages; the repo's "About" is filled in.
- **The daily data works:** BNR (from `curs.bnr.ro`) and Eurostat answer from GitHub Actions, and the bot commits "data: rates …". After every deploy, the `check` job fails (with an email) if the data has stopped updating. If a run's warnings look odd, read F-38…F-54 in `FINDINGS.md` first.
- **Waiting for the owner:** O-16 (protecting `main` and the tags, Dependabot for the actions).
- **By hand, monthly:** the deposit rate from BNR's Buletin lunar (table 10.1.2, households, 6–12 months; DESIGN §2) and the Tezaur rate of the month's issue.
- **Next:** the "Still in the app" table in `FINDINGS.md`; the ideas in `docs/IDEAS.md` only when the owner asks for them.

## Working rules

**Language**
- The app's interface (the text in `src/`) and `README.md` are in Romanian, with diacritics.
- Everything else is in English: code, comments, test names, messages, documents, commit messages.
- File names are always in English.

**Tests**
- They all live in `tests/` and use `node:test`.
- Run `npm test` before every commit. They must all pass.
- A test for a fix must fail without the fix: check it with a quick mutation (undo the fix, run the test).
- `tests/e2e.test.mjs` drives the built page in headless Chrome (Node 22+, no dependency). It skips locally when Chrome is missing and fails in GitHub Actions in that case. Behaviour of the page belongs there; pure logic belongs in a module of `src/js/` and that module's test file (`calc.js` → `calc.test`, `format.js` → `format.test`).
- When a DOM module decides something (which value, which sign or colour, when to show „—”), that decision goes into a pure exported function of the module, tested in Node; the DOM code only writes the result.
- Tests never read the real clock or today's data values; pass `today` explicitly.

**Bugs**
- Every problem found goes into `FINDINGS.md`, with:
  - a new `F-NN` ID (IDs are never reused);
  - the severity, the problem and the fix;
  - the test that covers it, where possible.
- `FINDINGS.md` has two tables: "Fixed" and "Still in the app". What is not fixed now goes into the second one, as `O-NN` (open) or as an accepted limitation.

**Commits**
- Small, by theme, with the FINDINGS IDs in the message.
- Author: `Romulus Mirăuță <181910713+RomulusMirauta@users.noreply.github.com>`. Without this address the commits don't show on the contributions graph.
- Commits you write carry the line `Co-Authored-By: Claude …`.

**Versions**
- A new version means: an entry in `CHANGELOG.md`, `version` updated in `package.json` and an annotated tag `vX.Y.Z`.

**Dependencies**
- Don't add new dependencies without asking. The project has none, and that is a decision, not an accident. A linter was considered on 29 Oct 2026 and not added for this reason; `tests/modules.test.mjs` loads every module in Node instead. A bundler was not added either: `bundle()` in `build.mjs` joins the modules.

**`src/`** (checked by `tests/page.test.mjs`, `tests/modules.test.mjs` and `tests/build.test.mjs`):
- `index.html` is the markup and the `<title>`, without `<!doctype>`, `<html>`, `<head>` or `<body>`: `build.mjs` writes those. It links `css/*.css` and one `<script type="module" src="js/main.js">`, and has nothing inline;
- the page is one file on the site: the build puts the CSS and the modules inline, so the CSP allows scripts only by hash (F-73). Don't serve the modules as separate files;
- modules use only `import { a, b } from './file.js';` and `export function|const|class`; anything else stops the build. Each module sees only what it imports;
- no requests to other sites; the data comes from `data/rates.json`, by a relative path;
- colours are only tokens, in `css/tokens.css`, defined for both themes (`404.html` copies that file whole);
- the calculations live in `js/calc.js`, as pure functions tested in `tests/calc.test.mjs`;
- paths are relative, because the site lives under `/taxa-pe-stat/`.

**Data**
- `data/rates.json` is written only by the bot (`scripts/update-data.mjs`); don't edit it by hand.
- The BNR forecast and the indicative interest rates live in `DATA`, in `src/js/builtin-data.js`, each with the month it is from (`asOf`, `report`). When you change them, update that month and the sources in `DESIGN.md` §2; the page flags them when they get old.
- If you change the formulas, update `DESIGN.md` §5 and the tests.

**Screenshots:** `docs/screenshot.png` is taken in the dark theme, at 1280×860, in the default state, at any moment (since F-85 the counter shows the loss since 1 January, so there is no value to wait for).

**Not in the repo:** `dist/`, `node_modules/`, `*.bundle`.

## Commands

```
npm run dev                    # local server with reload: http://localhost:5173
npm test                       # all the tests
npm run build                  # → dist/
node scripts/update-data.mjs   # today's data (needs internet; rewrites data/rates.json)
node scripts/check-fresh.mjs   # is the data still updating? (exit code 1 if not)
```

## The claude.ai artifact

The page was also published as a private artifact on claude.ai; its URL and last version (4) are in `artifact.json`. Since 29 Oct 2026 it is **no longer synced**: don't publish it unless the owner asks. Its `app.html` no longer exists: since the split into `src/` (1 Nov 2026), publishing it again would mean publishing `assemble()`'s output.

## Environment

- **Windows:** `start.cmd` starts the server and opens the browser.
- **The local folder is the clone:** the copy written from claude.ai was turned into a git clone (`docs/DEVELOPMENT.md`). What claude.ai writes shows up in `git status`.
- **The commit author** is set locally, in `.git/config`: the computer's global git uses another address. In a new clone, set `user.name` and `user.email` again.
- **`git config pull.rebase true`**, also in `.git/config`: the bot pushes data commits to `main` on weekdays, and a plain `git pull` would merge them into local work (F-89). Set it again in a new clone. Before a push, `git pull --rebase`.
- **`gh`** lives in `C:\Program Files\GitHub CLI\`, but may be missing from PATH (Git Bash: `"/c/Program Files/GitHub CLI/gh.exe"`). The active account must be `RomulusMirauta` (`gh auth status`).
