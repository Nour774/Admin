// ============ ⚡️ AdminShell Environment ============
let currentPath = ""; // المسار الحالي
let currentRole = "user"; // الدور الحالي
const TERMINAL_API_URL = "https://example.com/api"; // عدّل حسب سيرفرك
// ===================================================

// ============ ⚡️ AdminShell Commands (Final Stable Version) ============
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
      return "🔒 تم الرجوع إلى صلاحيات المستخدم العادي.";
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
// 🔐 أوامر الإدارة (admin / root فقط)
// ===================================================

// 🔹 cd
COMMANDS.cd = {
  description: "تغيير المجلد الحالي",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "❌ لا تملك صلاحيات كافية.";
    const target = args[0];
    if (!target) return "Usage: cd <folder>";

    const newPath = resolvePathCD(currentPath, target);
    const res = await fetch(`${TERMINAL_API_URL}?action=list&path=${newPath}`);
    const files = await res.json();

    if (!Array.isArray(files)) return `⚠️ المسار غير موجود: ${target}`;
    const folderExists = files.some(
      f => f.mimeType === "folder" || f.mimeType === "application/vnd.google-apps.folder"
    );

    if (!folderExists && files.length === 0) {
      return `❌ لم يتم العثور على المجلد: ${target}`;
    }

    currentPath = newPath;
    return `📂 تم الانتقال إلى [${getLastPart(newPath) || "~"}]`;
  }
};

// 🔹 mkdir
COMMANDS.mkdir = {
  description: "إنشاء مجلد جديد في Google Drive",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "❌ لا تملك صلاحيات كافية.";
    const folderName = args[0];
    if (!folderName) return "Usage: mkdir <folderName>";
    const path = currentPath ? `${currentPath}/${folderName}` : folderName;
    const res = await fetch(`${TERMINAL_API_URL}?action=mkdir&path=${path}`);
    return await res.text();
  }
};

// 🔹 list
COMMANDS.list = {
  description: "عرض الملفات والمجلدات (يدعم --all ومرشحات الامتدادات)",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "❌ لا تملك صلاحيات كافية.";

    let flags = { all: false, txt: false, js: false, doc: false, pdf: false, json: false, id: false, url: false };
    let searchTerm = null;
    let expectSearch = false;
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
      if (f.mimeType === "folder" || f.mimeType === "application/vnd.google-apps.folder") return true;
      const ext = f.name.split(".").pop().toLowerCase();
      if (flags.all) return true;
      if (flags.txt && ext === "txt") return true;
      if (flags.js && ext === "js") return true;
      if (flags.doc && ["doc", "docx"].includes(ext)) return true;
      if (flags.pdf && ext === "pdf") return true;
      if (flags.json && ext === "json") return true;
      if (!flags.txt && !flags.js && !flags.doc && !flags.pdf && !flags.json) return true;
      return false;
    };

    // 🌳 طباعة الشجرة (بخطوط ├── و └──)
    const printTree = async (path, prefix = "") => {
      const files = await fetchFiles(path);
      if (!files.length) return [];

      const visibleFiles = files.filter(filterByExt);
      let lines = [];

      for (let i = 0; i < visibleFiles.length; i++) {
        const f = visibleFiles[i];
        const isFolder = f.mimeType === "folder" || f.mimeType === "application/vnd.google-apps.folder";
        const isLast = i === visibleFiles.length - 1;
        const branch = isLast ? "└── " : "├── ";

        let line = prefix + branch + (isFolder ? `📂 [${f.name}]` : `📄 ${f.name}`);
        if (flags.id) line += ` | 🆔 ${f.id}`;
        if (flags.url) line += ` | 🔗 ${f.url}`;
        lines.push(line);

        if (isFolder && flags.all) {
          const subPath = path ? `${path}/${f.name}` : f.name;
          const subPrefix = prefix + (isLast ? "    " : "│   ");
          const subLines = await printTree(subPath, subPrefix);
          lines.push(...subLines);
        }
      }

      if (searchTerm) {
        lines = lines.filter(line => line.toLowerCase().includes(searchTerm));
      }

      return lines;
    };

    const output = await printTree(targetPath);
    return output.length ? output.join("\n") : "📁 لا توجد ملفات أو مجلدات.";
  }
};

// 🔹 create
COMMANDS.create = {
  description: "إنشاء ملف جديد (يدعم المسارات)",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "❌ لا تملك صلاحيات كافية.";
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
    if (role === "user") return "❌ لا تملك صلاحيات كافية.";
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
    if (role === "user") return "❌ لا تملك صلاحيات كافية.";
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
  if (target.startsWith("/")) return target; // مسار مطلق
  let parts = (base || "").split("/").filter(Boolean);
  const segments = target.split("/").filter(Boolean);
  for (const seg of segments) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}
