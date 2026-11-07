/* POST /api/login —— 登录：恒时比较哈希，签发 90 天会话 token */
import { json, hex, pbkdf2Hash, safeEq } from "./_lib.js";

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const pass = String(body.pass || "");
    if (!email || !pass) return json({ error: "请填写邮箱与密码" }, 400);

    const u = await env.DB.prepare(
      "SELECT id, email, pass_hash, salt FROM users WHERE email = ?"
    ).bind(email).first();
    if (!u) return json({ error: "邮箱或密码不正确" }, 401);
    const hash = await pbkdf2Hash(pass, u.salt);
    if (!safeEq(hash, u.pass_hash)) return json({ error: "邮箱或密码不正确" }, 401);

    const token = hex(16);
    await env.DB.prepare("INSERT INTO sessions(token, user_id, expires_at) VALUES(?, ?, ?)")
      .bind(token, u.id, Date.now() + 90 * 86400000).run();
    return json({ ok: true, token, email: u.email });
  } catch (e) {
    return json({ error: "登录失败，请重试" }, 500);
  }
}
