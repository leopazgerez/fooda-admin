import test from "node:test";
import assert from "node:assert/strict";
import { clearSession, getSession, mutex, needsRefresh, otraPestanaRenovo, refreshRejected, renewIfStale, saveSession, shouldRetryWithRefresh, type Session } from "./session.ts";

const user = { id: 1, email: "a@b.c", fullName: "A", role: "ADMIN", permissions: [], emailVerified: true, active: true } as unknown as Session["user"];
const ses = (accessExpiresAt: string, refreshToken = "r1"): Session => ({ accessToken: "a1", accessExpiresAt, refreshToken, user });

test("needsRefresh: menos de 60 s o fecha inválida", () => {
  const now = new Date("2026-11-26T12:00:00Z");
  assert.equal(needsRefresh(ses("2026-11-26T12:00:59Z"), now), true);
  assert.equal(needsRefresh(ses("2026-11-26T12:01:01Z"), now), false);
  assert.equal(needsRefresh(ses("no-es-fecha"), now), true);
});

function memoryStorage() {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k),
  };
  return store;
}

test("mutex: corre las funciones de a una, aunque una falle", async () => {
  const lock = mutex();
  const log: string[] = [];
  const paso = (n: string, falla = false) => lock(async () => { log.push(`${n}>`); await Promise.resolve(); log.push(`<${n}`); if (falla) throw new Error(n); });
  await Promise.allSettled([paso("a", true), paso("b")]);
  assert.deepEqual(log, ["a>", "<a", "b>", "<b"]);
});

test("renewIfStale: varias llamadas con el mismo token renuevan una sola vez", async () => {
  memoryStorage();
  saveSession(ses("2020-01-01T00:00:00Z"));
  const lock = mutex();
  let renovaciones = 0;
  const renew = async () => { renovaciones++; saveSession({ ...ses("2099-01-01T00:00:00Z", "r2"), accessToken: "a2" }); };
  await Promise.all([renewIfStale("a1", lock, renew), renewIfStale("a1", lock, renew), renewIfStale("a1", lock, renew)]);
  assert.equal(renovaciones, 1);
  assert.equal(getSession()?.refreshToken, "r2");
});

test("renewIfStale: si otra pestaña ya renovó (el token guardado cambió), no renueva", async () => {
  memoryStorage();
  saveSession({ ...ses("2099-01-01T00:00:00Z", "r2"), accessToken: "a2" });
  let renovaciones = 0;
  await renewIfStale("a1", mutex(), async () => { renovaciones++; });
  assert.equal(renovaciones, 0);
});

test("renewIfStale: sin sesión guardada (logout en otra pestaña) igual llama a renew, que la da por terminada", async () => {
  memoryStorage();
  let recibido: unknown = "nada";
  await renewIfStale("a1", mutex(), async (s) => { recibido = s; });
  assert.equal(recibido, null);
});

test("shouldRetryWithRefresh: solo un 401 fuera de /auth/ y sin reintento previo", () => {
  assert.equal(shouldRetryWithRefresh(401, "/sales", false), true);
  assert.equal(shouldRetryWithRefresh(401, "/sales", true), false);
  assert.equal(shouldRetryWithRefresh(401, "/auth/refresh", false), false);
  assert.equal(shouldRetryWithRefresh(403, "/sales", false), false);
});

test("getSession: con access vencido sigue si hay refresh token", () => {
  const store = memoryStorage();
  saveSession(ses("2020-01-01T00:00:00Z"));
  assert.equal(getSession()?.refreshToken, "r1");
  saveSession(ses("2020-01-01T00:00:00Z", ""));
  assert.equal(getSession(), null);
  store.set("admin_session", "{roto");
  assert.equal(getSession(), null);
});

test("refreshRejected: solo 400/401 cierran la sesión; un 5xx no", () => {
  assert.equal(refreshRejected(401), true);
  assert.equal(refreshRejected(400), true);
  assert.equal(refreshRejected(500), false);
  assert.equal(refreshRejected(503), false);
});

test("otraPestanaRenovo: si el refresh token guardado ya cambió, sigue sin esperar", async () => {
  memoryStorage();
  saveSession(ses("2099-01-01T00:00:00Z", "r2"));
  let esperas = 0;
  assert.equal(await otraPestanaRenovo("r1", 2000, 200, async () => { esperas++; }), true);
  assert.equal(esperas, 0);
});

test("otraPestanaRenovo: espera a que la otra pestaña termine de guardar (su 401 puede llegar antes)", async () => {
  memoryStorage();
  saveSession(ses("2099-01-01T00:00:00Z", "r1"));
  let esperas = 0;
  const dormir = async () => { if (++esperas === 2) saveSession(ses("2099-01-01T00:00:00Z", "r2")); };
  assert.equal(await otraPestanaRenovo("r1", 2000, 200, dormir), true);
  assert.equal(esperas, 2);
});

test("otraPestanaRenovo: si nadie renovó en el plazo, la sesión terminó de verdad", async () => {
  memoryStorage();
  saveSession(ses("2099-01-01T00:00:00Z", "r1"));
  let esperas = 0;
  assert.equal(await otraPestanaRenovo("r1", 1000, 200, async () => { esperas++; }), false);
  assert.equal(esperas, 5);
});

test("otraPestanaRenovo: sin sesión (logout en otra pestaña) no espera", async () => {
  memoryStorage();
  clearSession();
  let esperas = 0;
  assert.equal(await otraPestanaRenovo("r1", 2000, 200, async () => { esperas++; }), false);
  assert.equal(esperas, 0);
});
