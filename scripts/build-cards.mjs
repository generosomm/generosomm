// Builds the profile README images in the same look as generosomm.dev.
//
//   node scripts/build-cards.mjs hero        -> assets/hero.svg (committed)
//   node scripts/build-cards.mjs live [dir]  -> live cards in [dir] (default dist/)
//
// The live cards pull fresh numbers on every run:
//   - creator stats from https://generosomm.dev/api/stats (the portfolio's live API)
//   - GitHub activity and languages from the GitHub API (GITHUB_TOKEN)
// If a source is down, the card falls back to the last documented numbers.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const USER = process.env.GH_USER || "generosomm";
const TOKEN = process.env.GITHUB_TOKEN || "";
const PORTFOLIO_API = "https://generosomm.dev/api/stats";

// Tokens from generosomm.dev css/tokens.css
const C = {
  ink: "#0a0a0a",
  raised: "#0e0e0e",
  line: "rgba(255,255,255,0.08)",
  lineStrong: "rgba(255,255,255,0.18)",
  text: "#f2f2f0",
  mid: "#8c8c88",
  dim: "#6c6c66",
  accent: "#2bd47d",
  wash: "rgba(43,212,125,0.14)"
};

// Documented numbers from the master CV, used when the live API is unreachable.
const FALLBACK_CREATOR = { views: 274_000_000, followers: 260_000, posts: 2_600 };

async function fontFaces() {
  const load = async (file) => (await readFile(join(ROOT, "assets/fonts", file))).toString("base64");
  const faces = [
    ["Clash Display", "clash-display-600.woff2", 600],
    ["JetBrains Mono", "jetbrains-mono.woff2", 500],
    ["Satoshi", "satoshi-400.woff2", 400],
    ["Satoshi", "satoshi-500.woff2", 500]
  ];
  const css = [];
  for (const [family, file, weight] of faces) {
    css.push(`@font-face{font-family:"${family}";font-weight:${weight};src:url(data:font/woff2;base64,${await load(file)}) format("woff2");}`);
  }
  return css.join("");
}

const BASE_CSS = `
.display{font-family:"Clash Display",system-ui,sans-serif;font-weight:600;fill:${C.text}}
.mono{font-family:"JetBrains Mono",ui-monospace,monospace;font-weight:500;letter-spacing:.16em;text-transform:uppercase}
.body{font-family:Satoshi,system-ui,sans-serif;font-weight:400;fill:${C.mid}}
.accent{fill:${C.accent}}.mid{fill:${C.mid}}.dim{fill:${C.dim}}.text{fill:${C.text}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}
.live{animation:pulse 1.6s ease-in-out infinite}
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.rise{animation:rise .9s cubic-bezier(.2,.7,.2,1) both}
@media (prefers-reduced-motion:reduce){.live,.rise{animation:none}}
`;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function short(n) {
  if (n == null || Number.isNaN(n)) return "n/a";
  if (n >= 1e9) return `${+(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${Math.floor(n / 1e6)}M`;
  if (n >= 1e4) return `${Math.floor(n / 1e3)}K`;
  if (n >= 1e3) return `${+(n / 1e3).toFixed(1)}K`;
  return String(n);
}

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });

function svg(width, height, fonts, body, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<style>${fonts}${BASE_CSS}</style>
${body}
</svg>
`;
}

function frame(w, h) {
  return `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="18" fill="${C.ink}" stroke="${C.lineStrong}"/>`;
}

function label(x, y, text, { live = false, color = C.mid } = {}) {
  const dot = live
    ? `<circle class="live" cx="${x + 4}" cy="${y - 4}" r="4" fill="${C.accent}"/>`
    : "";
  return `${dot}<text x="${live ? x + 16 : x}" y="${y}" class="mono" font-size="12" fill="${color}">${esc(text)}</text>`;
}

/* ---------------- HERO ---------------- */

async function buildHero() {
  const fonts = await fontFaces();
  const portrait = (await readFile(join(ROOT, "assets/portrait.webp"))).toString("base64");
  const W = 1280, H = 560;

  // Fine grid like the portfolio's hairlines
  let grid = "";
  for (let x = 80; x < W; x += 80) grid += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${C.line}" stroke-width="1"/>`;

  const body = `
<defs>
  <radialGradient id="glow" cx="50%" cy="45%" r="50%">
    <stop offset="0" stop-color="${C.accent}" stop-opacity=".22"/>
    <stop offset="1" stop-color="${C.accent}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
    <stop offset=".72" stop-color="#fff"/>
    <stop offset="1" stop-color="#000"/>
  </linearGradient>
  <mask id="portraitFade"><rect x="760" y="70" width="400" height="${H}" fill="url(#fade)"/></mask>
  <clipPath id="card"><rect x="0" y="0" width="${W}" height="${H}" rx="22"/></clipPath>
</defs>
<g clip-path="url(#card)">
  <rect width="${W}" height="${H}" fill="${C.ink}"/>
  ${grid}
  <ellipse cx="960" cy="300" rx="320" ry="260" fill="url(#glow)"/>

  <g class="rise">
    ${label(72, 92, "Systems developer & creative technologist", { live: true, color: C.accent })}
  </g>

  <text x="64" y="270" class="display rise" font-size="168" letter-spacing="2" style="animation-delay:.1s">Merwin</text>

  <image href="data:image/webp;base64,${portrait}" x="760" y="70" width="400" height="600" mask="url(#portraitFade)" class="rise" style="animation-delay:.25s"/>

  <text x="64" y="420" class="display rise" font-size="168" letter-spacing="2" style="animation-delay:.18s">Generoso</text>

  <text x="68" y="474" class="body rise" font-size="24" style="animation-delay:.35s">Creating things you can click, use and watch.</text>

  <line x1="0" y1="${H - 52}" x2="${W}" y2="${H - 52}" stroke="${C.line}"/>
  <g class="rise" style="animation-delay:.45s">
    ${label(72, H - 21, "Full-stack development")}
    ${label(520, H - 21, "Video production")}
    ${label(930, H - 21, "generosomm.dev ↗")}
  </g>
</g>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="22" fill="none" stroke="${C.lineStrong}"/>
`;
  const out = join(ROOT, "assets/hero.svg");
  await writeFile(out, svg(W, H, fonts, body, "Merwin Generoso, systems developer and creative technologist"));
  console.log(`wrote ${out}`);
}

/* ---------------- LIVE DATA ---------------- */

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers: { "User-Agent": `${USER}-profile-cards`, ...headers }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function creatorStats() {
  try {
    const data = await getJson(PORTFOLIO_API);
    const t = data.totals || {};
    if (!t.views) throw new Error("no totals in response");
    return {
      views: Math.max(t.views, FALLBACK_CREATOR.views),
      followers: Math.max(t.followers || 0, FALLBACK_CREATOR.followers),
      posts: Math.max(t.posts || 0, FALLBACK_CREATOR.posts),
      source: "live",
      updatedAt: data.updatedAt || new Date().toISOString()
    };
  } catch (error) {
    console.warn(`creator stats fallback: ${error.message}`);
    return { ...FALLBACK_CREATOR, source: "documented", updatedAt: new Date().toISOString() };
  }
}

const gh = (path) => getJson(`https://api.github.com${path}`, TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {});

async function githubStats() {
  // Local preview without network: CARDS_FIXTURE=path/to/github.json
  if (process.env.CARDS_FIXTURE) return JSON.parse(await readFile(process.env.CARDS_FIXTURE, "utf8"));
  const user = await gh(`/users/${USER}`);
  const repos = (await gh(`/users/${USER}/repos?per_page=100&type=owner`)).filter((r) => !r.fork);
  const stars = repos.reduce((s, r) => s + r.stargazers_count, 0);

  const bytes = {};
  for (const repo of repos) {
    if (repo.name === USER) continue;
    try {
      const langs = await gh(`/repos/${USER}/${repo.name}/languages`);
      for (const [lang, n] of Object.entries(langs)) bytes[lang] = (bytes[lang] || 0) + n;
    } catch (error) {
      console.warn(`languages ${repo.name}: ${error.message}`);
    }
  }

  let calendar = null;
  if (TOKEN) {
    try {
      const res = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", "User-Agent": `${USER}-profile-cards` },
        body: JSON.stringify({
          query: `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount}}}}}}`,
          variables: { login: USER }
        })
      });
      const json = await res.json();
      calendar = json.data?.user?.contributionsCollection?.contributionCalendar ?? null;
      if (!calendar) throw new Error(JSON.stringify(json.errors || json).slice(0, 200));
    } catch (error) {
      console.warn(`contribution calendar: ${error.message}`);
    }
  }

  return { user, repos, stars, bytes, calendar };
}

function streaks(days) {
  let longest = 0, run = 0;
  for (const d of days) {
    run = d.contributionCount > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  // Current streak: today may still be empty, so start from yesterday in that case.
  let i = days.length - 1;
  if (i >= 0 && days[i].contributionCount === 0) i--;
  let current = 0;
  for (; i >= 0 && days[i].contributionCount > 0; i--) current++;
  return { current, longest };
}

/* ---------------- LIVE CARDS ---------------- */

function stat(x, y, value, caption) {
  return `<text x="${x}" y="${y}" class="display" font-size="46">${esc(value)}</text>
<text x="${x + 2}" y="${y + 30}" class="mono" font-size="11" fill="${C.mid}">${esc(caption)}</text>`;
}

function creatorCard(fonts, s) {
  const W = 620, H = 290;
  const sourceText = s.source === "live" ? `Live from generosomm.dev · ${fmtDate(s.updatedAt)}` : `Documented · ${fmtDate(s.updatedAt)}`;
  const body = `${frame(W, H)}
${label(32, 46, "ERO | VISUALS · creator stats", { live: s.source === "live", color: C.accent })}
${stat(32, 150, `${short(s.views)}+`, "Total views")}
${stat(232, 150, `${short(s.followers)}+`, "Followers")}
${stat(432, 150, `${short(s.posts)}+`, "Posts")}
<line x1="32" y1="236" x2="${W - 32}" y2="236" stroke="${C.line}"/>
<text x="32" y="264" class="mono" font-size="10.5" fill="${C.dim}">${esc(sourceText)}</text>
<text x="${W - 32}" y="264" text-anchor="end" class="mono" font-size="10.5" fill="${C.dim}">TikTok + YouTube</text>`;
  return svg(W, H, fonts, body, `Creator stats: ${short(s.views)}+ views, ${short(s.followers)}+ followers`);
}

function githubCard(fonts, g) {
  const W = 620, H = 290;
  const days = g.calendar ? g.calendar.weeks.flatMap((w) => w.contributionDays) : [];
  const { current, longest } = streaks(days);
  const total = g.calendar ? g.calendar.totalContributions : null;

  // 52-week heat strip, one column per week, 7 rows
  let cells = "";
  if (g.calendar) {
    const weeks = g.calendar.weeks.slice(-52);
    const max = Math.max(1, ...days.map((d) => d.contributionCount));
    const gap = 2.5, size = (W - 64 - (weeks.length - 1) * gap) / weeks.length, x0 = 32, y0 = 66;
    weeks.forEach((w, wi) => {
      w.contributionDays.forEach((d, di) => {
        const level = d.contributionCount === 0 ? 0 : Math.ceil((d.contributionCount / max) * 4);
        const fill = level === 0 ? "rgba(255,255,255,0.06)" : C.accent;
        const op = [1, 0.3, 0.55, 0.8, 1][level];
        cells += `<rect x="${(x0 + wi * (size + gap)).toFixed(1)}" y="${(y0 + di * (size + gap)).toFixed(1)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}" rx="1.5" fill="${fill}" fill-opacity="${op}"/>`;
      });
    });
  }

  const body = `${frame(W, H)}
${label(32, 46, "GitHub · last 12 months", { live: true, color: C.accent })}
${cells ? cells : ""}
${stat(32, 192, total == null ? "n/a" : String(total), "Contributions")}
${stat(232, 192, `${current}d`, "Current streak")}
${stat(432, 192, `${longest}d`, "Longest streak")}
<line x1="32" y1="236" x2="${W - 32}" y2="236" stroke="${C.line}"/>
<text x="32" y="264" class="mono" font-size="10.5" fill="${C.dim}">${esc(`${g.user.public_repos} public repos · ${g.stars} star${g.stars === 1 ? "" : "s"}`)}</text>
<text x="${W - 32}" y="264" text-anchor="end" class="mono" font-size="10.5" fill="${C.dim}">${esc(`Synced ${fmtDate(Date.now())}`)}</text>`;
  return svg(W, H, fonts, body, `GitHub: ${total ?? "n/a"} contributions in the last year`);
}

function languagesCard(fonts, g) {
  const W = 620, H = 290;
  const entries = Object.entries(g.bytes).sort((a, b) => b[1] - a[1]);
  const totalBytes = entries.reduce((s, [, n]) => s + n, 0) || 1;
  // Languages under 1% (build scripts, misdetections) fold into "Other".
  const top = entries.filter(([, n]) => n / totalBytes >= 0.01).slice(0, 6);
  const rest = totalBytes - top.reduce((s, [, n]) => s + n, 0);
  if (rest / totalBytes >= 0.005) top.push(["Other", rest]);

  const shades = [C.accent, "#6fe3a6", "#e8e6e0", "#8c8c88", "#4d4d4a", "#2f2f2d", "#1d1d1c"];
  const barX = 32, barW = W - 64, barY = 72;
  let x = barX, bar = "", legend = "";
  top.forEach(([lang, n], i) => {
    const w = (n / totalBytes) * barW;
    bar += `<rect x="${x.toFixed(1)}" y="${barY}" width="${Math.max(w - 2, 1).toFixed(1)}" height="10" rx="2" fill="${shades[i]}"/>`;
    x += w;
    const lx = barX + (i % 2) * (barW / 2), ly = barY + 64 + Math.floor(i / 2) * 36;
    legend += `<rect x="${lx.toFixed(1)}" y="${ly - 8}" width="8" height="8" rx="2" fill="${shades[i]}"/>
<text x="${(lx + 16).toFixed(1)}" y="${ly}" class="mono" font-size="11" fill="${C.text}" style="letter-spacing:.08em">${esc(lang)} <tspan fill="${C.dim}">${((n / totalBytes) * 100).toFixed(1)}%</tspan></text>`;
  });

  const body = `${frame(W, H)}
${label(32, 46, "Languages · public repos", { live: true, color: C.accent })}
${bar}${legend}
<line x1="32" y1="236" x2="${W - 32}" y2="236" stroke="${C.line}"/>
<text x="32" y="264" class="mono" font-size="10.5" fill="${C.dim}">By code size</text>
<text x="${W - 32}" y="264" text-anchor="end" class="mono" font-size="10.5" fill="${C.dim}">${esc(`Synced ${fmtDate(Date.now())}`)}</text>`;
  return svg(W, H, fonts, body, "Top languages across public repositories");
}

async function buildLive(dir) {
  const fonts = await fontFaces();
  await mkdir(dir, { recursive: true });
  const github = await githubStats();
  await writeFile(join(dir, "card-github.svg"), githubCard(fonts, github));
  await writeFile(join(dir, "card-languages.svg"), languagesCard(fonts, github));
  console.log(`wrote live cards to ${dir}`);
}

const [mode = "live", dir = "dist"] = process.argv.slice(2);
if (mode === "hero") await buildHero();
else await buildLive(resolve(dir));
