// 这个就是你要的 index.js，部署到Cloudflare Workers用
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const CORS = {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type"
    };

    if (req.method === "OPTIONS") return new Response("", { headers: CORS });

    // 初始化D1数据表（部署后先访问一次这个接口）
    if (url.pathname === "/init") {
      await env.DB.exec(`
        CREATE TABLE IF NOT EXISTS file_list (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user TEXT,
          name TEXT,
          kv_key TEXT,
          time TEXT
        );
      `);
      return Response.json({ ok: true, msg: "数据库初始化成功" }, { headers: CORS });
    }

    // 注册接口
    if (url.pathname === "/register" && req.method === "POST") {
      const { user, pwd } = await req.json();
      const has = await env.USER_KV.get(`user:${user}`);
      if (has) return Response.json({ ok: false, msg: "账号已存在" }, { headers: CORS });
      await env.USER_KV.put(`user:${user}`, pwd);
      return Response.json({ ok: true, msg: "注册成功" }, { headers: CORS });
    }

    // 登录接口
    if (url.pathname === "/login" && req.method === "POST") {
      const { user, pwd } = await req.json();
      const realPwd = await env.USER_KV.get(`user:${user}`);
      if (!realPwd || realPwd !== pwd) {
        return Response.json({ ok: false, msg: "账号密码错误" }, { headers: CORS });
      }
      return Response.json({ ok: true, user }, { headers: CORS });
    }

    // 上传文件（存到KV）
    if (url.pathname === "/upload" && req.method === "POST") {
      const form = await req.formData();
      const user = form.get("user");
      const file = form.get("file");
      const fileName = file.name;
      const kvKey = `file:${user}:${Date.now()}:${fileName}`;

      // 文件二进制存入KV
      const buf = await file.arrayBuffer();
      await env.USER_KV.put(kvKey, buf);

      // 记录到D1
      await env.DB.prepare(
        `INSERT INTO file_list(user,name,kv_key,time) VALUES (?,?,?,?)`
      ).bind(user, fileName, kvKey, new Date().toLocaleString()).run();

      return Response.json({ ok: true, name: fileName }, { headers: CORS });
    }

    // 获取当前用户文件列表
    if (url.pathname === "/list") {
      const user = url.searchParams.get("user");
      const res = await env.DB.prepare(
        `SELECT * FROM file_list WHERE user = ? ORDER BY id DESC`
      ).bind(user).all();
      return Response.json({ ok: true, list: res.results }, { headers: CORS });
    }

    // 下载文件
    if (url.pathname === "/download") {
      const key = url.searchParams.get("key");
      const data = await env.USER_KV.get(key, "arrayBuffer");
      if (!data) return new Response("文件不存在", { status: 404 });
      return new Response(data, {
        headers: {
          "Content-Disposition": `attachment; filename="${key.split(":").pop()}"`
        }
      });
    }

    // 删除文件
    if (url.pathname === "/del" && req.method === "POST") {
      const { id, kvKey } = await req.json();
      await env.USER_KV.delete(kvKey);
      await env.DB.prepare(`DELETE FROM file_list WHERE id=?`).bind(id).run();
      return Response.json({ ok: true }, { headers: CORS });
    }

    return new Response("网盘服务运行正常");
  }
};
