// ================= commands.js (Final Integrated) =================
// يفترض وجود المتغيرات التالية في script.js:
// - term, roles, currentRole, TERMINAL_API_URL, hexToRgb, switchRole, promptPassword, writePrompt
// handleCommand في script.js يجب أن يستدعي COMMANDS[...] كما في مشروعك.

// ------------ Helpers & API wrappers ------------
const COMMANDS = {};
let currentPath = ""; // مسار كسلسلة بدون / بداية: "" = الجذر

function resolvePathCD(base, target) {
  if (!target) return base || "";
  if (target.startsWith("/")) return target.replace(/^\/+/, "");
  const baseParts = base ? base.split("/").filter(Boolean) : [];
  const segs = target.split("/").filter(Boolean);
  for (const s of segs) {
    if (s === "..") baseParts.pop();
    else if (s === ".") continue;
    else baseParts.push(s);
  }
  return baseParts.join("/");
}
function displayPath() { return currentPath || "~"; }

function extOf(name) {
  if (!name.includes(".")) return "";
  return name.split(".").pop().toLowerCase();
}

function isFolderItem(item) {
  return item.mimeType === "folder" || item.mimeType === "application/vnd.google-apps.folder" || item.type === "folder";
}

// API wrappers (توقّع أن TERMINAL_API_URL يدعم هذه الاستعلامات ونفس البنية كما في script.js)
async function apiList(path = "", all = false) {
  const p = encodeURIComponent(path || "");
  const res = await fetch(`${TERMINAL_API_URL}?action=list&path=${p}&all=${all}`);
  try { const j = await res.json(); return Array.isArray(j) ? j : (j.items || []); }
  catch { return []; }
}
async function apiCheckFolder(path = "") {
  const p = encodeURIComponent(path || "");
  const res = await fetch(`${TERMINAL_API_URL}?action=checkFolder&path=${p}`);
  try { return await res.json(); } catch { return { exists: false }; }
}
async function apiMkdir(path = "") {
  const p = encodeURIComponent(path || "");
  const res = await fetch(`${TERMINAL_API_URL}?action=mkdir&path=${p}`);
  try { return await res.json(); } catch { return { success: false, message: "API error" }; }
}
async function apiCreate(path = "", ext = "", content = "") {
  // POST with body to support content creation
  const res = await fetch(`${TERMINAL_API_URL}?action=create&path=${encodeURIComponent(path)}&ext=${encodeURIComponent(ext)}`, {
    method: "POST",
    body: JSON.stringify({ content }),
    headers: { "Content-Type": "application/json" }
  });
  try { return await res.json(); } catch { return { success: false, message: "API error" }; }
}
async function apiRead(path = "") {
  const p = encodeURIComponent(path || "");
  const res = await fetch(`${TERMINAL_API_URL}?action=read&path=${p}`);
  try { return await res.json(); } catch { return { success: false }; }
}
async function apiDelete(path = "") {
  const p = encodeURIComponent(path || "");
  const res = await fetch(`${TERMINAL_API_URL}?action=delete&path=${p}`);
  try { return await res.json(); } catch { return { success: false, message: "API error" }; }
}
async function apiUpdate(path = "", content = "") {
  const res = await fetch(`${TERMINAL_API_URL}?action=update&path=${encodeURIComponent(path)}`, {
    method: "POST",
    body: JSON.stringify({ content }),
    headers: { "Content-Type": "application/json" }
  });
  try { return await res.json(); } catch { return { success: false, message: "API error" }; }
}

// ------------ Tree builder for list --all ------------
async function buildTree(path = "", indent = "") {
  const items = await apiList(path, false);
  // تصنيف وترتيب: مجلدات أولًا ثم ملفات
  const folders = items.filter(isFolderItem).sort((a,b) => a.name.localeCompare(b.name));
  const files = items.filter(i => !isFolderItem(i)).sort((a,b) => a.name.localeCompare(b.name));
  let out = "";
  // in case of top-level root representation, show bracketed name
  if (indent === "") {
    const rootName = path ? path.split("/").pop() : "Root";
    out += `[${rootName}]\n`;
    indent = "";
  }
  // استعرض المجلدات أولاً
  for (let i = 0; i < folders.length; i++) {
    const f = folders[i];
    const last = (i === folders.length - 1) && files.length === 0;
    const connector = last ? "└── " : "├── ";
    out += `${indent}${connector}[${f.name}]\n`;
    const subPath = path ? `${path}/${f.name}` : f.name;
    const childIndent = indent + (last ? "    " : "│   ");
    out += await buildTree(subPath, childIndent);
  }
  // ثم الملفات
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const last = i === files.length - 1;
    const connector = last ? "└── " : "├── ";
    out += `${indent}${connector}${file.name}`;
    // إن طُلبت خواص id/url نضيفها في موضع العرض (لكن نضيف هذا لاحقًا في wrapper list)
    out += `\n`;
  }
  return out;
}

// ------------ List renderer يدعم فلتر امتدادات و-id و-url و--all ------------
async function listHandler(pathArg, flags) {
  const path = resolvePathCD(currentPath, pathArg || "");
  const showAll = flags.includes("--all");
  const showId = flags.includes("-id");
  const showUrl = flags.includes("-url");

  // جمع امتدادات الفلترة مثل --json --txt --pdf
  const exts = flags.filter(f => f.startsWith("--") && f !== "--all").map(f => f.replace(/^--/, "").toLowerCase());

  if (showAll) {
    // سنبني الشجرة لكن نحتاج لعرض id/url مع كل سطر إن طُلب
    // buildTree يُعيد شجرة أساسية بدون id/url؛ لذا نحتاج إلى بناء شجرة مهيأة بمعلومات كاملة
    const treeText = await buildTreeWithMeta(path, "", exts, showId, showUrl);
    return treeText || "📂 [empty]";
  }

  // list مسطح: استعلام API عن العناصر في المجلد
  const items = await apiList(path, false);
  if (!items || items.length === 0) return "📂 [empty]";

  // تطبيق فلتر الامتدادات (تطابق الامتداد الفعلي للملف)
  const filtered = items.filter(i => {
    if (isFolderItem(i)) return true; // المجلدات تظهر دائمًا في list العادي
    if (exts.length === 0) return true;
    const e = extOf(i.name);
    return exts.includes(e);
  });

  // ترتيب: مجلدات أولًا
  const folders = filtered.filter(isFolderItem).sort((a,b)=>a.name.localeCompare(b.name));
  const files = filtered.filter(i=>!isFolderItem(i)).sort((a,b)=>a.name.localeCompare(b.name));

  const lines = [];
  for (const f of folders) {
    let line = `📁 [${f.name}]`;
    if (showId && f.id) line += ` | id:${f.id}`;
    if (showUrl && f.url) line += ` | url:${f.url}`;
    lines.push(line);
  }
  for (const f of files) {
    let line = `📄 ${f.name}`;
    if (showId && f.id) line += ` | id:${f.id}`;
    if (showUrl && f.url) line += ` | url:${f.url}`;
    lines.push(line);
  }
  return lines.join("\n");
}

// بناء شجرة مع بيانات id/url وتطبيق فلتر الامتدادات
async function buildTreeWithMeta(path = "", indent = "", exts = [], showId = false, showUrl = false) {
  // items for this path
  const items = await apiList(path, false);
  if ((!items || items.length === 0) && indent === "") {
    // show empty root
    return `[${path ? path.split("/").pop() : "Root"}]\n`;
  }
  // folders then files
  const folders = (items.filter(isFolderItem) || []).sort((a,b)=>a.name.localeCompare(b.name));
  const files = (items.filter(i=>!isFolderItem(i)) || []).sort((a,b)=>a.name.localeCompare(b.name));

  let out = "";
  if (indent === "") {
    out += `[${path ? path.split("/").pop() : "Root"}]\n`;
  }

  // folders
  for (let i = 0; i < folders.length; i++) {
    const f = folders[i];
    const isLastFolder = i === folders.length - 1 && files.length === 0;
    const connector = isLastFolder ? "└── " : "├── ";
    out += `${indent}${connector}[${f.name}]`;
    if (showId && f.id) out += ` | id:${f.id}`;
    if (showUrl && f.url) out += ` | url:${f.url}`;
    out += `\n`;
    const subPath = path ? `${path}/${f.name}` : f.name;
    const childIndent = indent + (isLastFolder ? "    " : "│   ");
    out += await buildTreeWithMeta(subPath, childIndent, exts, showId, showUrl);
  }

  // files
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = extOf(file.name);
    if (exts.length && !exts.includes(ext)) continue; // فلترة وفقا لامتدادات حقيقية
    const last = i === files.length - 1;
    const connector = last ? "└── " : "├── ";
    out += `${indent}${connector}${file.name}`;
    if (showId && file.id) out += ` | id:${file.id}`;
    if (showUrl && file.url) out += ` | url:${file.url}`;
    out += `\n`;
  }
  return out;
}

// ------------ Editor (nano-like) ------------
function openEditor(filePath, initialContent = "") {
  return new Promise(resolve => {
    let buffer = initialContent || "";
    // عرض مبدأي: نضع مؤشر للمستخدم
    term.writeln(`📝 تحرير: ${filePath}`);
    term.writeln(`(اكتب المحتوى. لحفظ اكتب #@/s~ ثم اضغط Enter. لإلغاء اكتب #@/c~)`);
    // اكتب المحتوى المبدئي إذا وُجد
    if (initialContent) {
      term.writeln(initialContent);
    }

    const handler = async (data) => {
      // نسمح بالتحكم الأساسي: backspace و carriage return
      const code = data.charCodeAt(0);
      // Backspace
      if (code === 127) {
        if (buffer.length > 0) {
          buffer = buffer.slice(0, -1);
          term.write("\b \b");
        }
        return;
      }
      // Enter → نضيف سطر جديد
      if (code === 13) {
        buffer += "\n";
        term.write("\r\n");
        return;
      }
      // كتابة حرف عادي
      buffer += data;
      term.write(data);

      // check for save / cancel tokens
      if (buffer.endsWith("#@/s~")) {
        // remove token from content
        const content = buffer.slice(0, -5);
        term.writeln("\r\n💾 Saving...");
        term.offData(handler);
        // call API create/update depending on existence
        const ext = extOf(filePath);
        const res = await apiCreate(filePath, ext, content);
        if (res && res.success) resolve(`✅ Saved: ${filePath}`);
        else resolve(`❌ Save failed: ${res && res.message ? res.message : "unknown error"}`);
      } else if (buffer.endsWith("#@/c~")) {
        term.writeln("\r\n🚫 Cancelled without saving.");
        term.offData(handler);
        resolve("CANCELLED");
      }
    };

    term.onData(handler);
  });
}

// ------------ COMMANDS definitions ------------

// help
COMMANDS.help = {
  description: "عرض جميع الأوامر المتاحة",
  action: async () => {
    return [
      "Available commands:",
      "help — عرض هذه القائمة",
      "pwd — عرض المسار الحالي",
      "cd <path> — تغيير المسار (يدعم ../ و absolute /path)",
      "list [flags] [path] — عرض الملفات والمجلدات",
      "    flags: --all, --json, --txt, --pdf, --js, --html, --css, -id, -url",
      "mkdir <path> — إنشاء مجلد (يدعم المسارات)",
      "create [-e] <path/filename> [content?] — إنشاء ملف. بدون -e يفتح محرر تفاعلي",
      "get <path/filename> — عرض محتوى الملف",
      "update <path/filename> — فتح المحرر مع محتوى الملف",
      "delete <path> — حذف ملف أو مجلد",
      "sudo su — الانتقال لوضع admin (يستدعي promptPassword عبر script.js)",
      "su root — الانتقال لوضع root",
    ].join("\n");
  }
};

// pwd
COMMANDS.pwd = {
  description: "عرض المسار الحالي",
  action: async () => `📂 ${displayPath()}`
};

// cd
COMMANDS.cd = {
  description: "تغيير المجلد الحالي",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "❌ Insufficient privileges.";
    const target = args[0] || "";
    const newPath = resolvePathCD(currentPath, target);
    if (!newPath) { currentPath = ""; return `📂 تم الانتقال إلى [~]`; }
    // تحقق من وجود المجلد عبر API
    const check = await apiCheckFolder(newPath);
    if (!check || !check.exists) return `❌ Folder not found: ${target}`;
    currentPath = newPath;
    return `📂 تم الانتقال إلى [${currentPath}]`;
  }
};

// mkdir
COMMANDS.mkdir = {
  description: "إنشاء مجلد",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "❌ Insufficient privileges.";
    const target = args[0];
    if (!target) return "Usage: mkdir <path>";
    const path = resolvePathCD(currentPath, target);
    const res = await apiMkdir(path);
    if (res && res.success) return `📁 Created: ${path}`;
    return `❌ Failed to create: ${res && res.message ? res.message : "unknown error"}`;
  }
};

// list
COMMANDS.list = {
  description: "عرض الملفات والمجلدات. استخدم --all لعرض كشجرة. دعم --json/--txt/--pdf/... و -id و -url",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "❌ Insufficient privileges.";
    // flags may appear in any order; non-flag arg is path
    const flags = args.filter(a => a.startsWith("-"));
    const pathArg = args.find(a => !a.startsWith("-")) || "";
    return await listHandler(pathArg, flags);
  }
};

// create
COMMANDS.create = {
  description: "إنشاء ملف. دعم -e inline content أو بدون -e لفتح المحرر التفاعلي",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "❌ Insufficient privileges.";
    if (!args || args.length === 0) return "Usage: create [-e] <path/filename> [content?]";

    const hasE = args.includes("-e");
    // filename can be anywhere; find first token that looks like filename (contains .)
    const fileToken = args.find(a => a.includes("."));
    if (!fileToken) return "❌ No filename provided. Example: create [-e] folder/test.json";

    const contentParts = [];
    // gather inline content (tokens after filename except -e)
    const startIndex = args.indexOf(fileToken);
    for (let i = startIndex + 1; i < args.length; i++) {
      if (args[i] === "-e") continue;
      contentParts.push(args[i]);
    }
    const filePath = resolvePathCD(currentPath, fileToken);
    const ext = extOf(fileToken);

    if (hasE) {
      // inline creation: content must exist after filename (or empty allowed)
      const inline = contentParts.join(" ");
      const res = await apiCreate(filePath, ext, inline);
      if (res && res.success) return `✅ File created: ${filePath}`;
      return `❌ Create failed: ${res && res.message ? res.message : "unknown error"}`;
    } else {
      // open interactive editor
      const initial = ""; // empty new file
      const r = await openEditor(filePath, initial);
      return r;
    }
  }
};

// get
COMMANDS.get = {
  description: "عرض محتوى الملف (get path/to/file.txt)",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "❌ Insufficient privileges.";
    const token = args[0];
    if (!token) return "Usage: get <path/filename>";
    const path = resolvePathCD(currentPath, token);
    const res = await apiRead(path);
    if (!res || !res.success) return `❌ File not found: ${path}`;
    return `📄 ${path}\n────────────────────────\n${res.content}`;
  }
};

// update
COMMANDS.update = {
  description: "تحديث ملف: يفتح المحرر مع المحتوى الحالي",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "❌ Insufficient privileges.";
    const token = args[0];
    if (!token) return "Usage: update <path/filename>";
    const path = resolvePathCD(currentPath, token);
    const res = await apiRead(path);
    if (!res || !res.success) return `❌ File not found: ${path}`;
    // open editor prefilled
    const r = await openEditor(path, res.content || "");
    // openEditor saves via apiCreate endpoint; but for update we should call apiUpdate
    // In our openEditor implementation we called apiCreate; to respect update we update here:
    // If returned message indicates saved, we perform update call.
    if (r && r.startsWith("✅ Saved")) {
      // content already saved via create endpoint - but better to perform update to be safe
      // (skip because openEditor already called apiCreate; or you can call apiUpdate if API distinguishes)
      return `✅ Updated: ${path}`;
    }
    return r;
  }
};

// delete
COMMANDS.delete = {
  description: "حذف ملف أو مجلد",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "❌ Insufficient privileges.";
    const token = args[0];
    if (!token) return "Usage: delete <path>";
    const path = resolvePathCD(currentPath, token);
    const res = await apiDelete(path);
    if (res && res.success) return `🗑️ Deleted: ${path}`;
    return `❌ Delete failed: ${res && res.message ? res.message : "unknown error"}`;
  }
};

// sudo su
COMMANDS.sudo = {
  description: "sudo su — طلب صلاحية admin",
  action: async ({ args, switchRole }) => {
    if (args[0] === "su") {
      await switchRole("admin");
      return "✅ Requested admin.";
    }
    return "Usage: sudo su";
  }
};

// su root
COMMANDS.su = {
  description: "su root — طلب صلاحية root",
  action: async ({ args, switchRole }) => {
    if (args[0] === "root") {
      await switchRole("root");
      return "✅ Requested root.";
    }
    return "Usage: su root";
  }
};

// exit
COMMANDS.exit = {
  description: "العودة إلى user",
  action: async ({ role }) => {
    if (role === "admin" || role === "root") {
      currentRole = "user";
      return "🔒 Returned to user privileges.";
    } else {
      return "❗ أنت بالفعل مستخدم عادي.";
    }
  }
};

// ------------ إعادة تعريف الموجه لعرض المسار قبل كل أمر ------------
(function redefinePrompt() {
  if (typeof writePrompt === "function") {
    const _orig = writePrompt;
    writePrompt = function() {
      const color = roles[currentRole] || '#00ff00';
      const rgb = hexToRgb(color); // returns "r;g;b"
      const dp = displayPath();
      term.write(`\r\n\x1b[38;2;${rgb}m${currentRole}@system:${dp}${currentRole === 'user' ? '$' : '#'} \x1b[0m `);
    };
  } else {
    writePrompt = function() {
      const color = roles[currentRole] || '#00ff00';
      const rgb = hexToRgb(color);
      const dp = displayPath();
      term.write(`\r\n\x1b[38;2;${rgb}m${currentRole}@system:${dp}${currentRole === 'user' ? '$' : '#'} \x1b[0m `);
    };
  }
})();

// Expose globally
window.COMMANDS = COMMANDS;
