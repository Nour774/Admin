// ============ ⚡️ AdminShell Commands (Advanced) ============
let currentPath = ""; // المسار الحالي

const COMMANDS = {};

// ===================================================
// 🔹 أوامر عامة
// ===================================================
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
    if (role === "user") return "❌ Insufficient privileges.";
    const target = args[0];
    if (!target) return "Usage: cd <folder>";

    const newPath = resolvePathCD(currentPath, target);
    const res = await fetch(`${TERMINAL_API_URL}?action=list&path=${newPath}`);
    const files = await res.json();
    if (!Array.isArray(files) || !files.some(f => f.mimeType === "folder")) {
      return `❌ Folder not found: ${target}`;
    }
    currentPath = newPath;
    return `📂 Moved to [${getLastPart(newPath) || "~"}]`;
  }
};

// 🔹 mkdir
COMMANDS.mkdir = {
  description: "إنشاء مجلد جديد في Google Drive",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "❌ Insufficient privileges.";
    const folderName = args[0];
    if (!folderName) return "Usage: mkdir <folderName>";
    const path = currentPath ? `${currentPath}/${folderName}` : folderName;
    const res = await fetch(`${TERMINAL_API_URL}?action=mkdir&path=${path}`);
    return await res.text();
  }
};

// 🔹 list
COMMANDS.list = {
  description: "عرض الملفات والمجلدات مع دعم البحث والمرشحات",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "❌ Insufficient privileges.";

    let flags = { all: false, txt: false, js: false, doc: false, pdf: false, json: false, id: false, url: false };
    let searchTerm = null;
    let searchFilesOnly = false;
    let targetPath = currentPath;

    // تحليل الوسائط
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
      else if (arg === "-n") searchFilesOnly = true;
      else {
        searchTerm = arg;
      }
    }

    const fetchFiles = async (path) => {
      const res = await fetch(`${TERMINAL_API_URL}?action=list&path=${path}`);
      const files = await res.json();
      return Array.isArray(files) ? files : [];
    };

    const filterFiles = f => {
      const isFolder = f.mimeType === "folder" || f.mimeType === "application/vnd.google-apps.folder";
      if (searchFilesOnly) {
        if (isFolder) return false; // تجاهل المجلدات عند البحث عن الملفات
        if (flags.txt && !f.name.endsWith(".txt")) return false;
        if (flags.js && !f.name.endsWith(".js")) return false;
        if (flags.doc && ![".doc", ".docx"].some(ext => f.name.endsWith(ext))) return false;
        if (flags.pdf && !f.name.endsWith(".pdf")) return false;
        if (flags.json && !f.name.endsWith(".json")) return false;
        if (searchTerm && !f.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
      } else {
        // بحث في المجلدات فقط
        if (!isFolder) return false;
        if (searchTerm && !f.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
      }
    };

    const printTree = async (path, indent = "") => {
      let files = await fetchFiles(path);
      files = files.filter(filterFiles);

      let lines = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const isFolder = f.mimeType === "folder" || f.mimeType === "application/vnd.google-apps.folder";
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
    return output.length ? output.join("\n") : "📁 No files or folders found.";
  }
};

// 🔹 create
COMMANDS.create = {
  description: "إنشاء ملف جديد (يدعم المسارات)",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "❌ Insufficient privileges.";
    const path = args[0];
    if (!path) return "Usage: create <path/filename>";
    const fullPath = currentPath ? `${currentPath}/${path}` : path;
    const res = await fetch(`${TERMINAL_API_URL}?action=create&path=${fullPath}`);
    return await res.text();
  }
};

// 🔹 update
COMMANDS.update = {
  description: "تحديث أو إنشاء ملف (يدعم المسارات)",
  restricted: true,
  action: async ({ role, args, rawInput }) => {
    if (role === "user") return "❌ Insufficient privileges.";
    const [path, ...rest] = args;
    if (!path) return "Usage: update <path/filename> <content>";

    const contentStart = rawInput.indexOf(path) + path.length;
    const content = rawInput.slice(contentStart).trim();
    const fullPath = currentPath ? `${currentPath}/${path}` : path;
    const res = await fetch(`${TERMINAL_API_URL}?action=update&path=${fullPath}&data=${encodeURIComponent(content)}`);
    return await res.text();
  }
};

// 🔹 delete
COMMANDS.delete = {
  description: "حذف ملف أو مجلد",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "❌ Insufficient privileges.";
    const path = args[0];
    if (!path) return "Usage: delete <path>";
    const fullPath = currentPath ? `${currentPath}/${path}` : path;
    const res = await fetch(`${TERMINAL_API_URL}?action=delete&path=${fullPath}`);
    return await res.text();
  }
};

// ===================================================
// 🔹 دوال مساعدة
// ===================================================
function getLastPart(path) {
  if (!path) return "";
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

function resolvePathCD(base, target) {
  if (!target) return base || "";
  if (target.startsWith("/")) return target;
  let parts = base.split("/").filter(Boolean);
  const segments = target.split("/").filter(Boolean);
  for (const seg of segments) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
                                           }
