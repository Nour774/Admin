// ============ ⚡️ AdminShell Commands (Drive Integrated Version) ============
let currentPath = ""; // المسار الحالي
const COMMANDS = {};

// ===================================================
// 🔹 أوامر عامة
// ===================================================

// 🔹 help
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

// 🔹 exit
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

// 🔹 sudo
COMMANDS.sudo = {
  description: "رفع الصلاحية إلى admin",
  action: async ({ args, switchRole }) => {
    if (args[0] === "su") await switchRole("admin");
    else return "Usage: sudo su";
  }
};

// 🔹 su
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
    if (role === "user") return "❌ Insufficient privileges.";

    const target = args[0];
    if (!target) return `📂 المسار الحالي: [${currentPath || "~"}]`;

    const newPath = resolvePathCD(currentPath, target);
    const res = await fetch(`${TERMINAL_API_URL}?action=list&path=${newPath}`);
    const files = await res.json();

    if (!Array.isArray(files)) return `❌ Folder not found: ${target}`;
    currentPath = newPath;

    return `📂 تم الانتقال إلى [${currentPath || "~"}]`;
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
  description: "عرض الملفات والمجلدات (يدعم الوسوم والبحث والمسارات)",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "❌ Insufficient privileges.";

    let flags = {
      all: false,
      txt: false,
      js: false,
      doc: false,
      pdf: false,
      json: false,
      showPath: false
    };

    let searchFile = null;
    let searchFolder = null;
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
      else if (arg === "-p") flags.showPath = true;
      else if (arg === "-n") searchFile = args[++i]?.toLowerCase() || "";
      else if (arg === "+n") searchFolder = args[++i]?.toLowerCase() || "";
      else targetPath = resolvePathCD(currentPath, arg);
    }

    const fetchFiles = async (path) => {
      const res = await fetch(`${TERMINAL_API_URL}?action=list&path=${path}`);
      const files = await res.json();
      return Array.isArray(files) ? files : [];
    };

    const filterByExt = f => {
      if (f.mimeType === "folder" || f.mimeType === "application/vnd.google-apps.folder")
        return !searchFile;
      const ext = f.name.split(".").pop().toLowerCase();
      if (flags.txt && ext !== "txt") return false;
      if (flags.js && ext !== "js") return false;
      if (flags.doc && !["doc", "docx"].includes(ext)) return false;
      if (flags.pdf && ext !== "pdf") return false;
      if (flags.json && ext !== "json") return false;
      return !flags.txt && !flags.js && !flags.doc && !flags.pdf && !flags.json;
    };

    const printTree = async (path, indent = "") => {
      let files = await fetchFiles(path);
      let lines = [];

      for (const f of files) {
        const isFolder = f.mimeType === "folder" || f.mimeType === "application/vnd.google-apps.folder";
        const nameLower = f.name.toLowerCase();

        if (searchFile && isFolder) continue;
        if (searchFolder && !isFolder) continue;
        if (searchFile && !nameLower.includes(searchFile)) continue;
        if (searchFolder && !nameLower.includes(searchFolder)) continue;
        if (!filterByExt(f)) continue;

        const displayName = isFolder ? `📂 [${f.name}]` : `📄 ${f.name}`;
        const line = indent + (flags.showPath ? `${displayName} (${path}/${f.name})` : displayName);
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
    return output.length ? output.join("\n") : "📁 لا توجد ملفات أو مجلدات مطابقة.";
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
  const parts = base.split("/").filter(Boolean);
  const segments = target.split("/").filter(Boolean);
  for (const seg of segments) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

// ===================================================
// 🔹 تعديل موجه الأوامر لعرض المسار الحالي (مثل Kali أو PowerShell)
// ===================================================
const originalWritePrompt = writePrompt;
writePrompt = function () {
  const color = roles[currentRole];
  const displayPath = currentPath || "~";
  term.write(`\r\n\x1b[38;2;${hexToRgb(color)}m${currentRole}@system:${displayPath}${currentRole === 'user' ? '$' : '#'} \x1b[0m `);
};
