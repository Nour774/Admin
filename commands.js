// ============ ⚡️ AdminShell Commands (Full Updated) ============
const COMMANDS = {};

// 🧭 المسار الحالي للمجلد
let currentPath = "/";  // ✅ إصلاح: تعريف المتغير قبل استخدامه

// 🔹 عرض الأوامر
COMMANDS.help = {
  description: "عرض جميع الأوامر المتاحة",
  action: async ({ role }) => {
    return Object.keys(COMMANDS)
      .filter(cmd => {
        const c = COMMANDS[cmd];
        if (c.restricted && role === "user") return false;
        return true;
      })
      .map(cmd => `• ${cmd} - ${COMMANDS[cmd].description}`)
      .join("\n");
  }
};

// 🔹 الصلاحيات
let currentRole = "user"; // ✅ يفضل أيضا تعريف الدور الحالي لتفادي undefined

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

COMMANDS.sudo = {
  description: "رفع الصلاحية إلى admin",
  action: async ({ args, switchRole }) => {
    if (args[0] === "su") await switchRole("admin");
    else return "Usage: sudo su";
  }
};

COMMANDS.su = {
  description: "رفع الصلاحية إلى root",
  action: async ({ args, switchRole }) => {
    if (args[0] === "root") await switchRole("root");
    else return "Usage: su root";
  }
};

// 🔹 echo
COMMANDS.echo = {
  description: "إعادة النص كما هو",
  action: async ({ args }) => args.join(" "),
};

// ===================================================
// 🔐 أوامر الإدارة (admin / root)
// ===================================================

// 🔹 cd
COMMANDS.cd = {
  description: "تغيير المجلد الحالي",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return " Insufficient privileges.";
    const target = args[0];
    if (!target) return "Usage: cd <folder>";
    const newPath = resolvePathCD(currentPath, target);

    const res = await fetch(`${TERMINAL_API_URL}?action=list&path=${newPath}`);
    const files = await res.json();
    if (!Array.isArray(files)) return "⚠️ Invalid response from server.";

    const folderExists = files.some(f => f.mimeType === "folder" && f.name === target);
    if (!folderExists) return `📁 Folder not found: ${target}`;

    currentPath = newPath;
    return `📂 Moved to [${getLastPart(newPath) || '~'}]`;
  }
};

// 🔹 mkdir
COMMANDS.mkdir = {
  description: "إنشاء مجلد جديد في Google Drive",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return " Insufficient privileges.";
    const folderName = args[0];
    if (!folderName) return "Usage: mkdir <folderName>";
    const path = currentPath ? `${currentPath}/${folderName}` : folderName;
    const res = await fetch(`${TERMINAL_API_URL}?action=mkdir&path=${path}`);
    return await res.text();
  }
};

// 🔹 list
COMMANDS.list = {
  description: "عرض الملفات والمجلدات مع دعم --all و -n للبحث",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return " Insufficient privileges.";

    let flags = { all: false, txt: false, js: false, doc: false, pdf: false, json: false, id: false, url: false };
    let searchTerm = null;
    let expectSearch = false;
    let targetPath = currentPath;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i].toLowerCase();
      if (arg === "--all") flags.all = true;
      else if (arg === "--txt") flags.txt = true;
      else if (arg === "--js") flags.js = true;
      else if (arg === "--doc") flags.doc = true;
      else if (arg === "--pdf") flags.pdf = true;
      else if (arg === "--json") flags.json = true;
      else if (arg === "-id") flags.id = true;
      else if (arg === "-url") flags.url = true;
      else if (arg === "-n") expectSearch = true;
      else {
        if (expectSearch) {
          searchTerm = arg;
          expectSearch = false;
        } else {
          targetPath = resolvePathCD(currentPath, arg);
        }
      }
    }

    const fetchFiles = async (path) => {
      const res = await fetch(`${TERMINAL_API_URL}?action=list&path=${path}`);
      const files = await res.json();
      return Array.isArray(files) ? files : [];
    };

    const filterByExt = f => {
      if (f.mimeType === "folder") return true;
      const ext = f.name.split(".").pop().toLowerCase();
      if (flags.all) return true;
      if (flags.txt && ext !== "txt") return false;
      if (flags.js && ext !== "js") return false;
      if (flags.doc && !["doc","docx"].includes(ext)) return false;
      if (flags.pdf && ext !== "pdf") return false;
      if (flags.json && ext !== "json") return false;
      return !flags.txt && !flags.js && !flags.doc && !flags.pdf && !flags.json;
    };

    const printTree = async (path, indent = "") => {
      let files = await fetchFiles(path);
      if (searchTerm && !flags.all) {
        files = files.filter(f => f.name.toLowerCase().includes(searchTerm));
      }

      let lines = [];
      for (const f of files) {
        if (!filterByExt(f)) continue;
        const isFolder = f.mimeType === "folder";
        const name = isFolder ? `📂 [${f.name}]` : `📄 ${f.name}`;
        let line = indent + name;
        if (flags.id) line += ` | 🆔 ${f.id}`;
        if (flags.url) line += ` | 🔗 ${f.url}`;
        lines.push(line);

        if (isFolder && flags.all) {
          const subPath = path ? `${path}/${f.name}` : f.name;
          const subLines = await printTree(subPath, indent + "  ");
          lines.push(...subLines);
        }
      }
      return lines;
    };

    const output = await printTree(targetPath);
    return output.length ? output.join("\n") : " No matching files or folders found.";
  }
};

// ===================================================
// 🔹 دوال مساعدة
function getLastPart(path) {
  if (!path) return "";
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

function resolvePathCD(base, target) {
  if (!target) return base;
  let parts = base.split("/").filter(Boolean);
  const segments = target.split("/").filter(Boolean);
  for (const seg of segments) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}
