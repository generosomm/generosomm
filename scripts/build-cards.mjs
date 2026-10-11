// Builds the profile README images in the same look as generosomm.dev.
//
//   node scripts/build-cards.mjs static      -> assets/*.svg panels (committed)
//   node scripts/build-cards.mjs live [dir]  -> live cards in [dir] (default dist/)
//
// The static panels (hero, about, services, work, editing, experience, stack,
// contact) reuse the portfolio's copy, fonts and colours. Rebuild them after
// editing the copy below. `hero` is kept as an alias for `static`.
//
// The live cards pull GitHub activity and languages from the GitHub API
// (GITHUB_TOKEN) on every run of .github/workflows/profile-cards.yml.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const USER = process.env.GH_USER || "generosomm";
const TOKEN = process.env.GITHUB_TOKEN || "";

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

const FONTS = {
  display: ["Clash Display", "clash-display-600.woff2", 600],
  mono: ["JetBrains Mono", "jetbrains-mono.woff2", 500],
  body: ["Satoshi", "satoshi-400.woff2", 400],
  bodyMedium: ["Satoshi", "satoshi-500.woff2", 500]
};

// Each panel embeds only the faces it uses, to keep the files small.
async function fontFaces(keys = Object.keys(FONTS)) {
  const css = [];
  for (const key of keys) {
    const [family, file, weight] = FONTS[key];
    const data = (await readFile(join(ROOT, "assets/fonts", file))).toString("base64");
    css.push(`@font-face{font-family:"${family}";font-weight:${weight};src:url(data:font/woff2;base64,${data}) format("woff2");}`);
  }
  return css.join("");
}

const BASE_CSS = `
.display{font-family:"Clash Display",system-ui,sans-serif;font-weight:600;fill:${C.text}}
.mono{font-family:"JetBrains Mono",ui-monospace,monospace;font-weight:500;letter-spacing:.16em;text-transform:uppercase}
.body{font-family:Satoshi,system-ui,sans-serif;font-weight:400;fill:${C.mid}}
.strong{font-family:Satoshi,system-ui,sans-serif;font-weight:500;fill:${C.text}}
.accent{fill:${C.accent}}.mid{fill:${C.mid}}.dim{fill:${C.dim}}.text{fill:${C.text}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}
.live{animation:pulse 1.6s ease-in-out infinite}
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.rise{animation:rise .9s cubic-bezier(.2,.7,.2,1) both}
@media (prefers-reduced-motion:reduce){.live,.rise{animation:none}}
`;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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

/* ---------------- STATIC PANEL HELPERS ---------------- */

const W = 1280, PAD = 64;

// SVG has no text wrapping, so lines are broken by an estimated character budget.
// {{word}} marks a word drawn in the accent colour, as on the portfolio.
function wrap(text, max) {
  const lines = [];
  let line = "";
  // Brand names stay on one line.
  for (const word of text.replace(/ERO \| VISUALS/g, "ERO | VISUALS").split(/ +/)) {
    const next = line ? `${line} ${word}` : word;
    if (next.replace(/\{\{|\}\}/g, "").length > max && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

const rich = (line) =>
  esc(line).replace(/\{\{(.+?)\}\}/g, (_, word) => `<tspan fill="${C.accent}">${word}</tspan>`);

// A wrapped paragraph; returns the markup and the y of its last baseline.
function para(x, y, text, { max, size, lh = 1.4, cls = "body", fill }) {
  const lines = wrap(text, max);
  const step = Math.round(size * lh);
  const fillAttr = fill ? ` fill="${fill}"` : "";
  const tspans = lines.map((l, i) => `<tspan x="${x}"${i ? ` dy="${step}"` : ""}>${rich(l)}</tspan>`).join("");
  return { svg: `<text x="${x}" y="${y}" class="${cls}" font-size="${size}"${fillAttr}>${tspans}</text>`, last: y + step * (lines.length - 1) };
}

function grid(h) {
  let out = "";
  for (let x = 80; x < W; x += 80) out += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="rgba(255,255,255,0.035)"/>`;
  return out;
}

// Section eyebrow, styled like the portfolio's mono labels: "01 / About".
function eyebrow(index, name, anchor) {
  return `<circle cx="${PAD + 4}" cy="67" r="4" fill="${C.accent}"/>
<text x="${PAD + 18}" y="72" class="mono" font-size="15" fill="${C.mid}"><tspan fill="${C.accent}">${esc(index)}</tspan>  /  ${esc(name)}</text>
<text x="${W - PAD}" y="72" text-anchor="end" class="mono" font-size="13" fill="${C.dim}">generosomm.dev${esc(anchor ? `/#${anchor}` : "")}</text>`;
}

function panel(h, head, inner) {
  return `<defs><clipPath id="card"><rect width="${W}" height="${h}" rx="22"/></clipPath></defs>
<g clip-path="url(#card)">
  <rect width="${W}" height="${h}" fill="${C.ink}"/>
  ${grid(h)}
  ${head}
  ${inner}
</g>
<rect x="0.5" y="0.5" width="${W - 1}" height="${h - 1}" rx="22" fill="none" stroke="${C.lineStrong}"/>`;
}

const hr = (y, x1 = PAD, x2 = W - PAD) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${C.line}"/>`;

// Small north-east arrow drawn as a path, so it never depends on font glyphs.
const arrow = (x, y, size = 16, color = C.accent) =>
  `<path d="M${x} ${y + size} L${x + size} ${y} M${x + 4} ${y} H${x + size} V${y + size - 4}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;

async function dataUri(rel, type) {
  return `data:${type};base64,${(await readFile(join(ROOT, rel))).toString("base64")}`;
}

async function write(name, h, fontKeys, body, title) {
  const out = join(ROOT, "assets", name);
  await writeFile(out, svg(W, h, await fontFaces(fontKeys), body, title));
  console.log(`wrote ${out}`);
}

/* ---------------- COPY (from generosomm.dev data/*.json, trimmed for GitHub) ---------------- */

const ABOUT = {
  text: "I turn ideas into things people can {{use}} and {{watch}}. Building websites and editing videos give me two ways to create, while AI keeps me curious about what I can try next.",
  facts: [
    ["Based in", "Sto. Tomas City, Batangas, PH"],
    ["Availability", "Remote, GMT+8"],
    ["Languages", "English & Filipino"]
  ]
};

const SERVICES = [
  {
    title: "Music, film & brand promotion",
    text: "Short-form edits for your release, shared through ERO | VISUALS.",
    includes: ["An edit shaped around your release", "Publishing across my social channels"]
  },
  {
    title: "Business websites",
    text: "A responsive home for your business, designed and built around what you do.",
    includes: ["Help customers understand your offer", "Make enquiries easy from any device"]
  },
  {
    title: "Video editing",
    text: "Turn your footage into focused short-form content.",
    includes: ["Hooks, captions and music that fit your story", "Ready for TikTok, Reels and YouTube Shorts"]
  }
];

const WORK = [
  { title: "ASINTA", summary: "Workforce platform for security agencies.", tags: ["React", "TypeScript", "Firebase"] },
  {
    title: "Document Tracking & Analytics",
    summary: "A document system for the City Government of Sto. Tomas. I led project coordination and contributed document routing, digital signatures and an admin dashboard.",
    tags: ["PHP", "MySQL"]
  },
  {
    title: "MSC NU Laguna Website",
    summary: "A live community platform. I led the Node.js and Express backend for membership, events and updates.",
    tags: ["Node.js", "Express", "MySQL"]
  },
  {
    title: "Goodness Gracious",
    summary: "Hotel EDI integration system. I led the hotel node in a five-team project exchanging ANSI X12 transactions over REST.",
    tags: ["JavaScript", "Cloud Functions", "Firestore"]
  },
  { title: "Zero to Deploy", summary: "A guided planner that turns a client idea into a clear, approved project plan.", tags: ["HTML", "CSS", "JavaScript"], live: true },
  { title: "Nexus Pass", summary: "An interactive digital pass that works directly in the browser.", tags: ["HTML", "CSS", "JavaScript"], live: true },
  { title: "This Portfolio", summary: "Framework-free and JSON-driven, designed and built from scratch.", tags: ["HTML", "CSS", "JavaScript"], live: true }
];

const EDITS = [
  { title: "Glass Child: Seven Sundays", platform: "TikTok", image: "assets/edits/seven-sundays-thumb.webp" },
  { title: "The Blueprint of the Trend", platform: "YouTube Short", image: "assets/edits/youtube-blueprint-thumb.webp" },
  { title: "That's So True: Gracie Abrams edit", platform: "TikTok", image: "assets/edits/thats-so-true-thumb.webp" }
];

const EXPERIENCE = [
  {
    role: "Full-Stack Developer",
    org: "ASINTA",
    period: "Aug 2026 to Present",
    summary: "Workforce platform for security agencies. React, TypeScript, Firebase."
  },
  {
    role: "Creator & Video Editor",
    org: "ERO | VISUALS",
    period: "Aug 2022 to Present",
    summary: "Deliver short-form content for freelance clients, handling briefs, revisions and deadlines. Campaign work includes music releases, film promotion and AI-generated video hooks."
  },
  {
    role: "Web Development Lead",
    org: "MSC NU Laguna",
    period: "Jun 2025 to Jul 2026",
    summary: "Led the production backend for a community platform. Coordinated API integration, troubleshooting and team documentation."
  },
  {
    role: "Project Lead",
    org: "City Government of Sto. Tomas",
    period: "2025 to 2026",
    summary: "Led requirements and stakeholder coordination for a PHP and MySQL document system used across city departments. Contributed routing, digital signatures and an admin dashboard."
  }
];

// [name, icon file, single-colour logo drawn in white]
const STACK = [
  ["Frontend", [["HTML5", "html5.svg"], ["CSS3", "css3.svg"], ["JavaScript", "javascript.svg"], ["TypeScript", "typescript.svg"], ["React", "react.svg"]]],
  ["Backend", [["Node.js", "nodejs.svg"], ["Express", "express.svg", true], ["PHP", "php.svg"]]],
  ["Data & cloud", [["MySQL", "mysql.svg", true], ["Firebase", "firebase.svg"]]],
  ["Tools", [["Claude", "claude.svg"], ["OpenAI", "openai.svg", true], ["Git", "git.svg"], ["GitHub", "github.svg", true], ["VS Code", "vscode.svg"], ["Vercel", "vercel.svg", true], ["Notion", "notion.svg", true], ["Trello", "trello.svg"]]],
  ["Creative", [["Premiere Pro", "premierepro.svg"], ["After Effects", "aftereffects.svg"], ["CapCut", "capcut.svg", true], ["Canva", "canva.svg"], ["Picsart", "picsart.svg"], ["Google Flow", "google-flow.webp", true]]],
  ["Integration & more", [["REST APIs"], ["EDI (ANSI X12)"], ["Systems integration"], ["Database design"], ["SQL"]]]
];

const CONTACT = {
  statement: "Need something built, or something cut?",
  rows: [
    ["Email", "generosomerwin10@gmail.com"],
    ["Availability", "Available for freelance projects & remote work"],
    ["Based in", "Sto. Tomas City, Batangas, PH  ·  GMT+8"]
  ]
};

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
    ${label(930, H - 21, "generosomm.dev")}
    ${arrow(1078, H - 33, 11, C.mid)}
  </g>
</g>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="22" fill="none" stroke="${C.lineStrong}"/>
`;
  const out = join(ROOT, "assets/hero.svg");
  await writeFile(out, svg(W, H, fonts, body, "Merwin Generoso, systems developer and creative technologist"));
  console.log(`wrote ${out}`);
}

/* ---------------- STATIC PANELS ---------------- */

async function buildAbout() {
  const p = para(PAD, 168, ABOUT.text, { max: 46, size: 48, lh: 1.2, cls: "display" });
  const lineY = p.last + 66;
  const colW = (W - PAD * 2) / ABOUT.facts.length;
  const facts = ABOUT.facts
    .map(([k, v], i) => {
      const x = PAD + i * colW;
      return `<text x="${x}" y="${lineY + 44}" class="mono" font-size="13" fill="${C.dim}">${esc(k)}</text>
<text x="${x}" y="${lineY + 82}" class="body" font-size="26" fill="${C.text}">${esc(v)}</text>`;
    })
    .join("");
  const H = lineY + 120;
  await write("about.svg", H, ["display", "mono", "body"], panel(H, eyebrow("01", "About", "about"), `${p.svg}${hr(lineY)}${facts}`),
    "About: I turn ideas into things people can use and watch. Building websites and editing videos give me two ways to create, while AI keeps me curious about what I can try next.");
}

async function buildServices() {
  const gap = 24, colW = (W - PAD * 2 - gap * 2) / 3, top = 116, inset = 30;
  const cards = SERVICES.map((s) => ({ s, title: wrap(s.title, 17), text: wrap(s.text, 28), inc: s.includes.map((t) => wrap(t, 31)) }));
  const titleLines = Math.max(...cards.map((c) => c.title.length));
  const textLines = Math.max(...cards.map((c) => c.text.length));
  const textY = top + 150 + (titleLines - 1) * 40;
  const incY = textY + (textLines - 1) * 34 + 76;
  const incStep = (n) => 26 * n + 26;
  const incH = Math.max(...cards.map((c) => c.inc.reduce((h, l) => h + incStep(l.length), 0)));
  const cardH = incY - top + incH + 14;
  const body = cards
    .map(({ title, text, inc: includes }, i) => {
      const x = PAD + i * (colW + gap), tx = x + inset;
      const titleSvg = title.map((l, j) => `<tspan x="${tx}"${j ? ' dy="40"' : ""}>${esc(l)}</tspan>`).join("");
      const textSvg = text.map((l, j) => `<tspan x="${tx}"${j ? ' dy="34"' : ""}>${esc(l)}</tspan>`).join("");
      let y = incY, inc = "";
      for (const lines of includes) {
        const tspans = lines.map((l, j) => `<tspan x="${tx + 20}"${j ? ' dy="26"' : ""}>${esc(l)}</tspan>`).join("");
        inc += `<line x1="${tx}" y1="${y - 28}" x2="${x + colW - inset}" y2="${y - 28}" stroke="${C.line}"/>
<rect x="${tx}" y="${y - 10}" width="7" height="7" rx="1.5" fill="${C.accent}"/>
<text x="${tx}" y="${y}" class="body" font-size="20" fill="${C.text}">${tspans}</text>`;
        y += incStep(lines.length);
      }
      return `<rect x="${x}" y="${top}" width="${colW}" height="${cardH}" rx="16" fill="${C.raised}" stroke="${C.line}"/>
<text x="${tx}" y="${top + 50}" class="mono" font-size="13" fill="${C.accent}">0${i + 1}</text>
<text x="${tx}" y="${top + 100}" class="display" font-size="34">${titleSvg}</text>
<text x="${tx}" y="${textY}" class="body" font-size="23">${textSvg}</text>
${inc}`;
    })
    .join("");
  const H = top + cardH + 64;
  await write("services.svg", H, ["display", "mono", "body"], panel(H, eyebrow("02", "Services", "services"), body),
    `Services: ${SERVICES.map((s) => `${s.title}. ${s.text}`).join(" ")}`);
}

async function buildWork() {
  const head = `<text x="${PAD}" y="168" class="display" font-size="72">Selected work.</text>
<text x="${PAD}" y="222" class="body" font-size="26">Web projects and systems, organized by focus.</text>`;
  let y = 276, rows = "";
  WORK.forEach((w, i) => {
    const summary = para(PAD + 96, y + 94, w.summary, { max: 84, size: 23, lh: 1.45 });
    rows += `${hr(y)}
<text x="${PAD}" y="${y + 52}" class="mono" font-size="14" fill="${C.dim}">${String(i + 1).padStart(2, "0")}</text>
<text x="${PAD + 96}" y="${y + 54}" class="display" font-size="36">${esc(w.title)}</text>
${w.live ? arrow(W - PAD - 16, y + 36, 16) : ""}
${summary.svg}
<text x="${W - PAD - (w.live ? 36 : 0)}" y="${y + 52}" text-anchor="end" class="mono" font-size="13" fill="${C.mid}">${esc(w.tags.join("  ·  "))}</text>`;
    y = summary.last + 40;
  });
  rows += hr(y);
  const H = y + 56;
  await write("work.svg", H, ["display", "mono", "body"], panel(H, eyebrow("03", "Work", "work"), `${head}${rows}`),
    `Selected work: ${WORK.map((w) => `${w.title}. ${w.summary}`).join(" ")}`);
}

async function buildEditing() {
  const head = para(PAD, 168, "Short-form edits built to earn attention.", { max: 40, size: 56, lh: 1.1, cls: "display" });
  const org = `<text x="${PAD}" y="${head.last + 52}" class="mono" font-size="14" fill="${C.mid}"><tspan fill="${C.accent}">ERO | VISUALS</tspan>   Aug 2022 to Present</text>`;
  const gap = 24, colW = (W - PAD * 2 - gap * 2) / 3, top = head.last + 96, imgH = 420;
  let thumbs = "";
  for (const [i, e] of EDITS.entries()) {
    const x = PAD + i * (colW + gap);
    const href = await dataUri(e.image, "image/webp");
    thumbs += `<clipPath id="t${i}"><rect x="${x}" y="${top}" width="${colW}" height="${imgH}" rx="14"/></clipPath>
<rect x="${x}" y="${top}" width="${colW}" height="${imgH}" rx="14" fill="${C.raised}"/>
<image href="${href}" x="${x}" y="${top}" width="${colW}" height="${imgH}" preserveAspectRatio="xMidYMid slice" clip-path="url(#t${i})"/>
<rect x="${x + 0.5}" y="${top + 0.5}" width="${colW - 1}" height="${imgH - 1}" rx="14" fill="none" stroke="${C.line}"/>
<text x="${x}" y="${top + imgH + 40}" class="mono" font-size="13" fill="${C.accent}">${esc(e.platform)}</text>
<text x="${x}" y="${top + imgH + 76}" class="strong" font-size="23">${esc(e.title)}</text>`;
  }
  const H = top + imgH + 120;
  await write("editing.svg", H, ["display", "mono", "bodyMedium"], panel(H, eyebrow("04", "Video editing", "edits"), `${head.svg}${org}${thumbs}`),
    `Video editing with ERO | VISUALS: ${EDITS.map((e) => e.title).join(", ")}`);
}

async function buildExperience() {
  const head = `<text x="${PAD}" y="168" class="display" font-size="72">Experience</text>`;
  const col = PAD + 300;
  let y = 224, rows = "";
  for (const e of EXPERIENCE) {
    const summary = para(col, y + 134, e.summary, { max: 78, size: 23, lh: 1.45 });
    rows += `${hr(y)}
<text x="${PAD}" y="${y + 56}" class="mono" font-size="14" fill="${C.mid}">${esc(e.period)}</text>
<text x="${col}" y="${y + 58}" class="display" font-size="36">${esc(e.role)}</text>
<text x="${col}" y="${y + 94}" class="mono" font-size="14" fill="${C.accent}">${esc(e.org)}</text>
${summary.svg}`;
    y = summary.last + 44;
  }
  rows += hr(y);
  const H = y + 56;
  await write("experience.svg", H, ["display", "mono", "body"], panel(H, eyebrow("05", "Experience", "experience"), `${head}${rows}`),
    `Experience: ${EXPERIENCE.map((e) => `${e.role}, ${e.org}, ${e.period}`).join("; ")}`);
}

async function buildStack() {
  const head = `<text x="${PAD}" y="168" class="display" font-size="72">Stack</text>`;
  const chipH = 50, icon = 24, x0 = PAD + 260, xMax = W - PAD;
  let y = 224, body = "";
  for (const [group, items] of STACK) {
    body += hr(y);
    y += 28;
    body += `<text x="${PAD}" y="${y + 31}" class="mono" font-size="13" fill="${C.mid}">${esc(group)}</text>`;
    let x = x0;
    for (const [name, file, mono] of items) {
      const w = Math.round((file ? icon + 12 : 0) + name.length * 9.6 + 40);
      if (x + w > xMax) {
        x = x0;
        y += chipH + 14;
      }
      let img = "";
      if (file) {
        const href = await dataUri(`assets/icons/${file}`, file.endsWith(".svg") ? "image/svg+xml" : "image/webp");
        img = `<image href="${href}" x="${x + 18}" y="${y + (chipH - icon) / 2}" width="${icon}" height="${icon}"${mono ? ' filter="url(#white)"' : ""}/>`;
      }
      body += `<rect x="${x}" y="${y}" width="${w}" height="${chipH}" rx="${chipH / 2}" fill="${C.raised}" stroke="${C.lineStrong}"/>
${img}<text x="${x + (file ? 18 + icon + 12 : 20)}" y="${y + 32}" class="strong" font-size="20">${esc(name)}</text>`;
      x += w + 12;
    }
    y += chipH + 28;
  }
  body += hr(y);
  const defs = `<defs><filter id="white" color-interpolation-filters="sRGB"><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"/></filter></defs>`;
  const H = y + 56;
  await write("stack.svg", H, ["display", "mono", "bodyMedium"], panel(H, eyebrow("06", "Stack", "stack"), `${defs}${head}${body}`),
    `Stack. ${STACK.map(([g, items]) => `${g}: ${items.map((i) => i[0]).join(", ")}`).join(". ")}`);
}

async function buildContact() {
  const head = para(PAD, 176, CONTACT.statement, { max: 24, size: 84, lh: 1.02, cls: "display" });
  let y = head.last + 70, rows = "";
  for (const [k, v] of CONTACT.rows) {
    rows += `${hr(y)}
<text x="${PAD}" y="${y + 50}" class="mono" font-size="13" fill="${C.dim}">${esc(k)}</text>
<text x="${PAD + 260}" y="${y + 52}" class="body" font-size="26" fill="${C.text}">${esc(v)}</text>`;
    y += 82;
  }
  rows += hr(y);
  const btnY = y + 40, btnW = 220;
  const btn = `<rect x="${PAD}" y="${btnY}" width="${btnW}" height="60" rx="30" fill="${C.accent}"/>
<text x="${PAD + 32}" y="${btnY + 37}" class="mono" font-size="15" fill="${C.ink}">Email me</text>
${arrow(PAD + btnW - 52, btnY + 22, 16, C.ink)}`;
  const H = btnY + 60 + 64;
  await write("contact.svg", H, ["display", "mono", "body"], panel(H, eyebrow("07", "Contact", "contact"), `${head.svg}${rows}${btn}`),
    `${CONTACT.statement} Email generosomerwin10@gmail.com. Available for freelance projects and remote work.`);
}

async function buildStatic() {
  await buildHero();
  await buildAbout();
  await buildServices();
  await buildWork();
  await buildEditing();
  await buildExperience();
  await buildStack();
  await buildContact();
}

/* ---------------- LIVE DATA ---------------- */

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers: { "User-Agent": `${USER}-profile-cards`, ...headers }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
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
if (mode === "static" || mode === "hero") await buildStatic();
else await buildLive(resolve(dir));
