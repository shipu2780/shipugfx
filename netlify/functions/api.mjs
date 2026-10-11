import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

export const config = { path: "/api/*" };

// Built-in projects. They are used until the first save from the dashboard, then stored in Netlify Blobs.
const SEED = [
  { id: "seed-rosetta", name: "Rosetta Ecom Store", location: "London, United Kingdom", role: "Social Media Manager & Marketing Strategist", logo: "/assets/logos/rosetta.webp", w: 1000, h: 206, tile: "#ffffff", flush: false, cap: 0, size: "wide" },
  { id: "seed-innovated", name: "Innovated Visions Jewelry", location: "New York, United States", role: "Social Media Manager", logo: "/assets/logos/innovated-visions-jewelry.webp", w: 140, h: 140, tile: "#ffffff", flush: false, cap: 150, size: "" },
  { id: "seed-shaka", name: "Shaka Dakan Music Production", location: "Utah, United States", role: "Website Designer", logo: "/assets/logos/shaka-dakan.png", w: 150, h: 60, tile: "#12151f", flush: false, cap: 190, size: "" },
  { id: "seed-suga-t", name: "Suga-T", location: "California, United States", role: "Social Media Manager & Virtual Assistant", logo: "/assets/logos/suga-t.jpg", w: 447, h: 447, tile: "#f1efe9", flush: true, cap: 0, size: "" },
  { id: "seed-daurham", name: "Daurham Hair Product LLC", location: "Arizona, United States", role: "Project Manager", logo: "/assets/logos/daurham.webp", w: 800, h: 800, tile: "linear-gradient(180deg,#d8ba5a,#ffffff)", flush: true, cap: 0, size: "" },
  { id: "seed-rr", name: "R & R Custom Construction", location: "Washington, United States", role: "Digital Marketer", logo: "/assets/logos/rr-custom-construction.jpg", w: 500, h: 500, tile: "#000000", flush: true, cap: 0, size: "" },
  { id: "seed-tulle", name: "Tulle Threads", location: "Qatar", role: "Social Media Marketing Manager & Strategist", logo: "/assets/logos/tulle-threads.webp", w: 900, h: 676, tile: "#fff6f2", flush: false, cap: 420, size: "wide-lg" },
];

const J = (d, s = 200, h = {}) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...h } });
const bad = (m) => Object.assign(new Error(m), { expected: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const secret = () => process.env.SESSION_SECRET || "";
const configured = () => !!process.env.ADMIN_PASSWORD && secret().length >= 16;
const sha = (v) => crypto.createHash("sha256").update(String(v)).digest();
const same = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));
const sign = (p) => crypto.createHmac("sha256", secret()).update(p).digest("base64url");
const COOKIE = "HttpOnly; Secure; SameSite=Strict; Path=/";

function makeToken() {
  const p = Buffer.from(JSON.stringify({ exp: Date.now() + 12 * 3600 * 1000 })).toString("base64url");
  return p + "." + sign(p);
}
function authed(req) {
  if (!configured()) return false;
  const m = (req.headers.get("cookie") || "").match(/(?:^|;\s*)admin_session=([^;]+)/);
  if (!m) return false;
  const [p, s] = m[1].split(".");
  if (!p || !s || !same(sign(p), s)) return false;
  try { return JSON.parse(Buffer.from(p, "base64url").toString()).exp > Date.now(); } catch { return false; }
}

const projectsStore = () => getStore({ name: "projects", consistency: "strong" });
async function load() {
  const d = await projectsStore().get("index", { type: "json" });
  return Array.isArray(d) ? d : SEED.map((x) => ({ ...x }));
}
const save = (list) => projectsStore().setJSON("index", list);

const str = (v, n) => String(v ?? "").trim().slice(0, n);
const int = (v, lo, hi) => { const n = parseInt(v, 10); return n >= lo && n <= hi ? n : 0; };
function clean(b, old) {
  const o = { ...old };
  o.name = str(b.name, 80);
  if (!o.name) throw bad("Add a project name.");
  o.location = str(b.location, 80);
  o.role = str(b.role, 100);
  o.description = str(b.description, 220);
  const link = str(b.link, 300);
  if (link && !/^https?:\/\//i.test(link)) throw bad("The website link must start with http:// or https://");
  o.link = link;
  if (b.tile !== undefined) {
    if (!/^#[0-9a-f]{6}$/i.test(String(b.tile))) throw bad("Choose a valid background colour.");
    o.tile = b.tile;
  }
  o.flush = !!b.flush;
  o.cap = int(b.cap, 40, 1200);
  o.size = ["", "wide", "wide-lg"].includes(b.size) ? b.size : "";
  return o;
}

const TYPES = { "image/png": 1, "image/jpeg": 1, "image/webp": 1, "image/gif": 1 };
async function putLogo(p, body) {
  const m = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(body.logo || "");
  if (!m || !TYPES[m[1]]) throw bad("The logo must be a PNG, JPG, WebP or GIF image.");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > 2 * 1024 * 1024) throw bad("The logo is larger than 2 MB. Use a smaller image.");
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  await getStore("logos").set(p.id, ab, { metadata: { type: m[1] } });
  p.logo = "/api/logo/" + p.id + "?v=" + Date.now();
  p.w = int(body.logoW, 1, 4000);
  p.h = int(body.logoH, 1, 4000);
}

async function logo(id) {
  if (!/^[a-z0-9-]{3,40}$/i.test(id || "")) return J({ error: "Not found" }, 404);
  const r = await getStore("logos").getWithMetadata(id, { type: "arrayBuffer" });
  if (!r) return J({ error: "Not found" }, 404);
  return new Response(r.data, { headers: { "content-type": r.metadata?.type || "image/png", "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
}

async function login(req) {
  if (!configured()) return J({ error: "Admin sign-in isn't set up yet. Add ADMIN_PASSWORD and SESSION_SECRET (16+ characters) in Netlify, then redeploy." }, 503);
  const b = await req.json().catch(() => ({}));
  const okUser = same(b.username ?? "", process.env.ADMIN_USERNAME || "admin");
  const okPass = same(b.password ?? "", process.env.ADMIN_PASSWORD);
  if (!(okUser && okPass)) { await sleep(900); return J({ error: "Check your username and password." }, 401); }
  return J({ ok: true }, 200, { "set-cookie": "admin_session=" + makeToken() + "; " + COOKIE + "; Max-Age=43200" });
}

async function admin(req, id, sub) {
  const list = await load();
  const body = req.method === "DELETE" ? {} : await req.json().catch(() => { throw bad("That request could not be read."); });
  if (req.method === "POST" && !id) {
    const p = clean(body, { tile: "#ffffff" });
    if (!body.logo) throw bad("Add a logo image.");
    p.id = "p-" + crypto.randomUUID().slice(0, 8);
    await putLogo(p, body);
    list.push(p);
    await save(list);
    return J({ project: p }, 201);
  }
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return J({ error: "Project not found." }, 404);
  if (req.method === "PUT") {
    list[i] = clean(body, list[i]);
    if (body.logo) await putLogo(list[i], body);
    await save(list);
    return J({ project: list[i] });
  }
  if (req.method === "POST" && sub === "move") {
    const j = i + (body.dir === -1 ? -1 : 1);
    if (j >= 0 && j < list.length) [list[i], list[j]] = [list[j], list[i]];
    await save(list);
    return J({ ok: true });
  }
  if (req.method === "DELETE") {
    const [gone] = list.splice(i, 1);
    await save(list);
    if (String(gone.logo).startsWith("/api/logo/")) await getStore("logos").delete(gone.id).catch(() => {});
    return J({ ok: true });
  }
  return J({ error: "Not found" }, 404);
}

export default async (req) => {
  const url = new URL(req.url);
  const [a, b, c, d] = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  try {
    if (req.method === "GET" && a === "projects") return J({ projects: await load() }, 200, { "cache-control": "public, max-age=0, must-revalidate" });
    if (req.method === "GET" && a === "logo") return await logo(b);
    if (req.method === "GET" && a === "session") return J({ authenticated: authed(req), configured: configured() });
    if (req.method !== "GET") {
      const o = req.headers.get("origin");
      if (o && new URL(o).host !== url.host) return J({ error: "Request blocked." }, 403);
      if (Number(req.headers.get("content-length") || 0) > 3.5 * 1024 * 1024) return J({ error: "That upload is too large." }, 413);
    }
    if (req.method === "POST" && a === "login") return await login(req);
    if (req.method === "POST" && a === "logout") return J({ ok: true }, 200, { "set-cookie": "admin_session=; " + COOKIE + "; Max-Age=0" });
    if (a === "admin" && b === "projects") {
      if (!authed(req)) return J({ error: "Your session ended. Please sign in again." }, 401);
      return await admin(req, c, d);
    }
    return J({ error: "Not found" }, 404);
  } catch (e) {
    if (!e.expected) console.error(e);
    return J({ error: e.expected ? e.message : "Something went wrong on the server." }, e.expected ? 400 : 500);
  }
};
