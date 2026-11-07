/* POST /api/register —— 注册：限速 + PBKDF2 加盐哈希 + 自动登录（返回 90 天 token） */
import { json, hex, pbkdf2Hash, allowRegister } from "./_lib.js";

export async function onRequestPost({ request, env }) {
  try {
    const source = request.headers.get("cf-connecting-ip") || "local";
    if (!allowRegister(source))
      return json({ error: "注册过于频繁，请稍后再试" }, 429);

    const body = await request.json().catch(() => ({}));
    console.log("[register] body =", JSON.stringify(body), "| pass 类型:", typeof body.pass, "| 长度:", body.pass ? String(body.pass).length : "null");
    const email = String(body.email || "").trim().toLowerCase();
    const pass = String(body.pass || "");
    if (!/^[^\s@]{1,64}@[^\s@]+\.[^\s@]{1,}$/.test(email) || email.length > 80)
      return json({ error: "邮箱格式不正确" }, 400);
    if (pass.length < 6 || pass.length > 72)
      return json({ error: "密码需为 6–72 位", debug: { passLen: pass.length, passType: typeof body.pass, bodyKeys: Object.keys(body), emailLen: email.length } }, 400);

    if (await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first())
      return json({ error: "该邮箱已注册" }, 409);

    const salt = hex(16);
    const hash = await pbkdf2Hash(pass, salt);
    const ins = await env.DB.prepare(
      "INSERT INTO users(email, pass_hash, salt, created_at) VALUES(?, ?, ?, ?)"
    ).bind(email, hash, salt, Date.now()).run();

    const token = hex(16);
    await env.DB.prepare("INSERT INTO sessions(token, user_id, expires_at) VALUES(?, ?, ?)")
      .bind(token, ins.meta.last_row_id, Date.now() + 90 * 86400000).run();
    return json({ ok: true, token, email });
  } catch (e) {
    return json({ error: "注册失败，请重试" }, 500);
  }
}
