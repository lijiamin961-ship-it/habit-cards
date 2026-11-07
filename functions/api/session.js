/* DELETE /api/session —— 退出登录：吊销当前会话 token */
import { json } from "./_lib.js";

export async function onRequestDelete({ request, env }) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "未登录" }, 401);
  await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  return json({ ok: true });
}
