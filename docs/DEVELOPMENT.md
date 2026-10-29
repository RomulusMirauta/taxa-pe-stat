# How we work

Notes on how the project is built and maintained. For the calculations and the data, see [`DESIGN.md`](../DESIGN.md).

## With Claude

The project is built with the help of Claude (Anthropic), as an assistant for:
- reviews;
- code;
- tests;
- documents.

Commits made by Claude carry a `Co-Authored-By: Claude …` line.

The instructions for Claude Code (local sessions, e.g. from VS Code) are in [`CLAUDE.md`](../CLAUDE.md). Claude Code reads it automatically at startup: the project in brief, where we left off, the working rules.

**Conventions:**
- language: the app's interface and `README.md` are in Romanian; everything else (code, comments, tests, documents, commit messages, file names) is in English;
- all the tests live in `tests/`;
- every bug found goes into [`FINDINGS.md`](../FINDINGS.md), with a new ID that is never reused and, where possible, a test.

## The claude.ai artifact (no longer synced)

Besides the site, the app was also published as a private artifact on claude.ai. The link and the last published version (4) are in [`artifact.json`](../artifact.json).

- **Why the same file worked in both places:** the artifact received `app.html` as a fragment, without `<head>`. That is why `app.html` has no `<!doctype>`, and `build.mjs` wraps it for the site.
- **No longer synced since 29 October 2026:** the site on GitHub Pages is the reference. The artifact stays at version 4, with the data of that day.

## The local copy

On the author's computer, the folder that Claude writes to from claude.ai, through the desktop app, is also the git clone of the repo. It was turned into a clone in place, from a history bundle (`taxa-pe-stat.bundle`, deleted after the first push), with `origin` on GitHub.

- **What Claude writes from claude.ai** shows up in `git status`, like any local change. Commits and pushes are made from here.
- **`.github/`:** from claude.ai, Claude is not allowed to write there on the computer. The workflows are changed from Claude Code or in the repo.
- **The commit author** is set in the clone's own config (`.git/config`), because the computer's global git config uses another address (`CLAUDE.md`, "Environment").
