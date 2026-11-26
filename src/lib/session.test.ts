import test from "node:test";
import assert from "node:assert/strict";
import { getSession, needsRefresh, refreshRejected, saveSession, shouldRetryWithRefresh, singleFlight, type Session } from "./session.ts";

const user = { id: 1, email: "a@b.c", fullName: "A", role: "ADMIN", permissions: [], emailVerified: true, active: true } as unknown as Session["user"];
const ses = (accessExpiresAt: string, refreshToken = "r1"): Session => ({ accessToken: "a1", accessExpiresAt, refreshToken, user });

test("needsRefresh: menos de 60 s o fecha inválida", () => {
  const now = new Date("2026-11-26T12:00:00Z");
  assert.equal(needsRefresh(ses("2026-11-26T12:00:59Z"), now), true);
  assert.equal(needsRefresh(ses("2026-11-26T12:01:01Z"), now), false);
  assert.equal(needsRefresh(ses("no-es-fecha"), now), true);
});

test("singleFlight: llamadas simultáneas comparten una ejecución", async () => {
  let count = 0;
  const run = singleFlight(async () => ++count);
  assert.deepEqual(await Promise.all([run(), run(), run()]), [1, 1, 1]);
  assert.equal(count, 1);
  assert.equal(await run(), 2);
});

test("singleFlight: después de un error vuelve a ejecutar", async () => {
  let count = 0;
  const run = singleFlight(async () => { count++; if (count === 1) throw new Error("x"); return count; });
  await assert.rejects(run());
  assert.equal(await run(), 2);
});

test("shouldRetryWithRefresh: solo un 401 fuera de /auth/ y sin reintento previo", () => {
  assert.equal(shouldRetryWithRefresh(401, "/sales", false), true);
  assert.equal(shouldRetryWithRefresh(401, "/sales", true), false);
  assert.equal(shouldRetryWithRefresh(401, "/auth/refresh", false), false);
  assert.equal(shouldRetryWithRefresh(403, "/sales", false), false);
});

test("getSession: con access vencido sigue si hay refresh token", () => {
  const store = new Map<string, string>();
  (globalThis as { sessionStorage?: unknown }).sessionStorage = {
    getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k),
  };
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
