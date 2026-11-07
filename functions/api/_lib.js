/* 云同步后端公共库：JSON 响应 / 随机数 / PBKDF2 / 恒时比较 / 会话鉴权
   运行环境：Cloudflare Workers（Web Crypto 标准 API，不自造加密轮子） */
export function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
/* n 字节随机数 → hex（注册盐 16B=128bit；会话 token 16B=128bit） */
export function hex(bytes) {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return [...b].map(x => x.toString(16).padStart(2, "0")).join("");
}
/* PBKDF2-SHA256，10 万次迭代，输出 256bit hex */
export async function pbkdf2Hash(pass, saltHex) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveBits"]);
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(x => parseInt(x, 16)));
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 },
    key, 256
  );
  return [...new Uint8Array(bits)].map(x => x.toString(16).padStart(2, "0")).join("");
}
/* 恒时比较，防时序侧信道 */
export function safeEq(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
/* Authorization: Bearer <token> → 会话有效期内的用户；否则 null */
export async function authUser(request, env) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  return env.DB.prepare(
    "SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?"
  ).bind(token, Date.now()).first() || null;
}

/* 注册限速：按连接来源分组计数（内存版，单 Isolate 有效；重启即清） */
const regHits = new Map();
export function allowRegister(sourceKey) {
  const now = Date.now();
  const arr = (regHits.get(sourceKey) || []).filter(t => now - t < 60000);
  const ok = arr.length < 3;
  if (ok) { arr.push(now); regHits.set(sourceKey, arr); }
  return ok;
}
