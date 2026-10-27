# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A service that serves comma three (AGNOS) "Custom Software" installer binaries for the **cloudypilot** fork (`CHaucke89/cloudypilot`). It was adapted from sunnypilot's openpilot-installer-generator. It takes a prebuilt installer binary and patches the repo, branch, and loading message into it by replacing strings in the bytes on each request.

URL format: `installer.hauckelabs.dev/<branch>`. The whole path is the branch, so branches containing `/` work. An empty path installs `DEFAULT_BRANCH`.

There are two implementations of the same behavior:

- **[src/index.js](src/index.js): Cloudflare Worker, the production deployment.** It is configured in [wrangler.jsonc](wrangler.jsonc), and its custom domain route is `installer.hauckelabs.dev`.
- **[index.php](index.php) + [build_agnos.php](build_agnos.php) + [common.php](common.php): the original PHP/Apache version**, kept as a reference.

The repo, default branch, loading message, and branch validation are written separately in `src/index.js` and `common.php`. Keep them in sync if both are still in use.

## Commands

```sh
npm install
npm run dev        # wrangler dev on http://localhost:8787
npm run deploy     # wrangler deploy (needs `npx wrangler login`)
npx wrangler deploy --dry-run   # validate config/bundle without deploying

curl "http://localhost:8787/ch-dev"                                   # webpage
curl -A "AGNOSSetup" -o installer "http://localhost:8787/ch-dev"      # device flow
strings installer | grep -E 'github.com|Installing|git checkout'      # check the patched values
```

There are no tests. To check the Worker against the PHP version, run `php -S localhost:8765` and fetch `index.php?url=<branch>` with `curl -L -A AGNOSSetup`. The output should be byte-identical (`cmp`) to the Worker's binary for the same branch. `php -S` ignores [.htaccess](.htaccess), which is why you pass `url` yourself. The PHP version writes `log.txt` (gitignored); the Worker uses `console.log`, which shows up in Workers Logs.

## Request flow (Worker)

- `run_worker_first` sends every request through the Worker. Only `/favicon.ico` is passed to the static assets in [public/](public/), so the unpatched binary is never served directly.
- A user agent containing `AGNOSSetup` or `Wget`, or a `?download` query, gets the patched binary. Anything else gets the HTML page.
- The branch is pasted into shell commands that the installer runs on the device. `validBranch` / `valid_branch()` therefore restrict it to git-ref characters. Treat this check as a security boundary.

## Binary patching (the non-obvious part)

`public/installer_openpilot_agnos` is compiled elsewhere, inside an openpilot tree. You cannot build it from this repo. [source/installer_source_agnos.cc](source/installer_source_agnos.cc) is a reference copy of what it was compiled from. The binary contains **numeric placeholder strings** (digits of e, π, and φ). The patching code overwrites them in place, and **the replacement must keep the binary's byte length unchanged**:

- e (53 chars) → `owner/repo.git`, padded with `\0`
- φ (255 chars, appears 3 times) → branch, padded with `\0`
- π (39 chars) → loading message, padded with **spaces** because Qt renders NULs

The Worker finds the placeholder offsets once per isolate and copies the patched bytes into a fresh copy of the binary for each request. If you change a placeholder constant, it must still match the string in the shipped binary exactly. If you rebuild the binary, keep the placeholder `#define`s unchanged.

NEOS (comma two) is not supported. `build_neos.php`, `installer_openpilot_neos`, and `source/installer_source_neos.c` are left over from upstream and nothing routes to them. The NEOS binary hardcodes `/openpilot.git`, so it can't install a repo named `cloudypilot`. The README still describes the original multi-fork `smiskol.com/fork` deployment.
