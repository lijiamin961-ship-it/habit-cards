/* GET/PUT /api/state —— 用户数据快照：每用户一行，整体覆盖式存取 */
import { json } from "./_lib.js";

/* 会话 token → 用户（鉴权统一走 _lib 的 authUser 时可复用此内联版） */
async function user(request, env) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  return env.DB.prepare(
    "SELECT u.id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?"
  ).bind(token, Date.now()).first() || null;
}

export async function onRequestGet({ request, env }) {
  const u = await user(request, env);
  if (!u) return json({ error: "未登录" }, 401);
  const row = await env.DB.prepare("SELECT data_json, updated_at FROM states WHERE user_id = ?")
    .bind(u.id).first();
  return json({
    ok: true,
    data: row ? JSON.parse(row.data_json) : null,
    updated_at: row ? row.updated_at : 0
  });
}

export async function onRequestPut({ request, env }) {
  const u = await user(request, env);
  if (!u) return json({ error: "未登录" }, 401);
  const body = await request.json().catch(() => ({}));
  if (!body.data || typeof body.data !== "object") return json({ error: "数据快照无效" }, 400);
  const updated = Number(body.updated_at) || Date.now();
  await env.DB.prepare(
    "INSERT INTO states(user_id, data_json, updated_at) VALUES(?, ?, ?) " +
    "ON CONFLICT(user_id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at"
  ).bind(u.id, JSON.stringify(body.data), updated).run();
  return json({ ok: true, updated_at: updated });
}
