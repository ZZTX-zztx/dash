const WORKER_URL = "https://dash.3809026566.workers.dev";
let currentUser = "";

async function register() {
  const user = document.getElementById("username").value;
  const pwd = document.getElementById("password").value;

  const res = await fetch(WORKER_URL + "/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user, pwd })
  });

  const data = await res.json();
  alert(data.msg);
}

async function login() {
  const user = document.getElementById("username").value;
  const pwd = document.getElementById("password").value;

  const res = await fetch(WORKER_URL + "/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user, pwd })
  });

  const data = await res.json();
  if (data.ok) {
    currentUser = user;
    document.getElementById("auth-page").classList.add("hidden");
    document.getElementById("disk-page").classList.remove("hidden");
    document.getElementById("user-name").innerText = user;
    loadFiles();
  } else {
    alert(data.msg);
  }
}

async function loadFiles() {
  const res = await fetch(WORKER_URL + "/list?user=" + currentUser);
  const data = await res.json();
  const list = document.getElementById("file-list");
  list.innerHTML = "";

  data.list.forEach(file => {
    const div = document.createElement("div");
    div.className = "file-item";
    div.innerHTML = `
      <span>${file.name}</span>
      <div>
        <button onclick="download('${file.kv_key}')">下载</button>
        <button onclick="del(${file.id}, '${file.kv_key}')">删除</button>
      </div>
    `;
    list.appendChild(div);
  });
}

async function uploadFile() {
  const file = document.getElementById("file-input").files[0];
  if (!file) return alert("请选择文件");

  const form = new FormData();
  form.append("user", currentUser);
  form.append("file", file);

  await fetch(WORKER_URL + "/upload", { method: "POST", body: form });
  alert("上传成功");
  loadFiles();
}

function download(key) {
  window.open(WORKER_URL + "/download?key=" + encodeURIComponent(key));
}

async function del(id, key) {
  if (!confirm("确定删除？")) return;
  await fetch(WORKER_URL + "/del", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, kvKey: key })
  });
  loadFiles();
}
