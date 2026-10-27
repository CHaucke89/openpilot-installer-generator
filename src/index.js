// Cloudflare Worker port of index.php + build_agnos.php

const GITHUB_REPO = "CHaucke89/cloudypilot";  // owner/repo installed by every generated binary
const DEFAULT_BRANCH = "master";
const LOADING_MSG = "cloudypilot";  // shown as "Installing cloudypilot", max 39 chars
const WEBSITE_URL = "https://installer.hauckelabs.dev";

// Placeholders compiled into installer_openpilot_agnos (see source/installer_source_agnos.cc).
// Each is overwritten in place, padded to its exact length so the binary's size never changes.
const PLACEHOLDERS = {
  repo: { text: "27182818284590452353602874713526624977572470936999595", pad: 0 },  // "owner/repo.git"
  loading_msg: { text: "314159265358979323846264338327950288419", pad: 0x20 },  // QT actually displays null characters, so pad with spaces
  branch: { text: "161803398874989484820458683436563811772030917980576286213544862270526046281890244970720720418939113748475408807538689175212663386222353693179318006076672635443338908659593958290563832266131992829026788067520876689250171169620703222104321626954862629631361", pad: 0 },
};

const encoder = new TextEncoder();

// The branch gets pasted into shell commands run by the installer, so only allow characters valid in git refs
function validBranch(branch) {
  return branch.length <= 255 && /^[A-Za-z0-9._\/-]+$/.test(branch) && !branch.includes("..");
}

function findAll(haystack, needle) {
  const offsets = [];
  outer: for (let i = haystack.indexOf(needle[0]); i !== -1 && i <= haystack.length - needle.length; i = haystack.indexOf(needle[0], i + 1)) {
    for (let j = 1; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    offsets.push(i);
  }
  return offsets;
}

// Load the unmodified installer once per isolate and locate every placeholder
let template;
function loadTemplate(env) {
  template ??= (async () => {
    const res = await env.ASSETS.fetch("https://assets.local/installer_openpilot_agnos");
    if (!res.ok) throw new Error(`installer binary missing (${res.status})`);
    const binary = new Uint8Array(await res.arrayBuffer());
    const offsets = {};
    for (const [name, { text }] of Object.entries(PLACEHOLDERS)) {
      offsets[name] = findAll(binary, encoder.encode(text));
      if (offsets[name].length === 0) throw new Error(`placeholder for ${name} not found in binary`);
    }
    return { binary, offsets };
  })().catch((err) => { template = undefined; throw err; });
  return template;
}

async function buildInstaller(env, branch) {
  const { binary, offsets } = await loadTemplate(env);
  const out = binary.slice();
  const values = { repo: GITHUB_REPO + ".git", loading_msg: LOADING_MSG, branch };
  for (const [name, value] of Object.entries(values)) {
    const { text, pad } = PLACEHOLDERS[name];
    const bytes = encoder.encode(value);
    if (bytes.length > text.length) throw new Error(`Invalid ${name} length!`);
    const filled = new Uint8Array(text.length).fill(pad);
    filled.set(bytes);
    for (const offset of offsets[name]) out.set(filled, offset);
  }
  return new Response(out, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": "attachment; filename=installer_openpilot",
      "Cache-Control": "no-store",
    },
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function renderPage(branch, useDefault, valid) {
  let body;
  if (!valid) {
    body = "<h3>❗ Invalid branch name ❗</h3>";
  } else {
    const branchHtml = escapeHtml(branch);
    body = useDefault
      ? `</br><h2>Enter this URL on your device during setup with the format:</h2>
<h2><span>${WEBSITE_URL}/branch</span></h2>
<h3>Leaving the branch off installs <a href="https://github.com/${GITHUB_REPO}/tree/${DEFAULT_BRANCH}">${DEFAULT_BRANCH}</a>.</h3>`
      : `<h3>Given branch: <a href="https://github.com/${GITHUB_REPO}/tree/${branchHtml}">${branchHtml}</a></h3>`;
    body += `<a href="?download" download="installer_openpilot"><button class="button" name="download_agnos">Download Installer Binary</button></a>
<h5>Or enter this URL on the setup screen on your device.</h5>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.gstatic.com">
<link href="https://fonts.googleapis.com/css2?family=Roboto&display=swap" rel="stylesheet">
<style>
body {background-image: linear-gradient(#F9DEC9, #99B2DD); min-height: 100vh; margin: 0; font-family: "Roboto", sans-serif; color: #30323D; text-align: center;}
span { color: #6369D1; }
a { text-decoration: none; color: #6369D1;}
button[name="download_agnos"] {background-color: #ace6df; border-radius: 4px; border: 5px; padding: 10px 12px; box-shadow:0px 4px 0px #80c2ba; display: inline-block; color: #30323D;top: 1px; outline: 0px transparent !important; cursor: pointer;}
button:active[name="download_agnos"] {border-radius: 4px; border: 5px; padding: 10px 12px; box-shadow:0px 2px 2px #89c7c7; background-color: #89c7c7; display: inline-block; top: 1px; outline: 0px transparent !important;}
</style>
<title>cloudypilot installer</title>
<link rel="icon" type="image/x-icon" href="/favicon.ico">
</head>
<body>
</br></br><a href="/"><h1 style="color: #30323D;">☁️ cloudypilot installer ☁️</h1></a>
<h3 style="position: absolute; bottom: 0; left: 0; width: 100%; text-align: center;"><a href="https://github.com/${GITHUB_REPO}" style="color: #30323D;">💾 cloudypilot GitHub Repo</a></h3>
${body}
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/favicon.ico") return env.ASSETS.fetch(request);

    // The whole path is the branch, so branches with slashes work (installer.hauckelabs.dev/feature/foo)
    let branch;
    try {
      branch = decodeURIComponent(url.pathname).replace(/^[\/ ]+|[\/ ]+$/g, "");
    } catch {
      branch = url.pathname;  // malformed escape; fails validation below
    }
    const useDefault = branch === "";
    if (useDefault) branch = DEFAULT_BRANCH;
    const valid = validBranch(branch);

    const userAgent = request.headers.get("User-Agent") ?? "";
    const isDevice = userAgent.includes("AGNOSSetup") || userAgent.includes("Wget");
    const wantsBinary = isDevice || url.searchParams.has("download");
    console.log(JSON.stringify({ path: url.pathname, branch, valid, is_device: isDevice, download: wantsBinary, user_agent: userAgent }));

    if (wantsBinary) {
      if (!valid) return new Response("Error: Invalid branch name!", { status: 400 });
      return buildInstaller(env, branch);
    }
    return new Response(renderPage(branch, useDefault, valid), {
      status: valid ? 200 : 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
};
