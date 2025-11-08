// ============ ⚡️ AdminShell Commands (Stable Recursive Edition) ============
const COMMANDS = {};

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

// 🔹 exit / sudo / su
COMMANDS.exit = {
  description: "العودة إلى user",
  action: async ({ role }) => {
    if (role === "admin" || role === "root") {
      currentRole = "user";
      return "🔒 Returned to user privileges.";
    }
    return "❗ أنت بالفعل مستخدم عادي.";
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
  action: async ({ args }) => args.join(" ")
};

// ===================================================
// 🔐 أوامر الإدارة
// ===================================================

// 🔹 cd
COMMANDS.cd = {
  description: "تغيير المجلد الحالي",
  restricted: true,
  action: async ({ role, args, setPrompt }) => {
    if (role === "user") return " Insufficient privileges.";
    const target = args[0];
    if (!target) return "Usage: cd <folder>";

    const newPath = resolvePathCD(currentPath, target);
    const res = await fetch(`${TERMINAL_API_URL}?action=stat&path=${newPath}`);
    const stat = await res.json();

    if (!stat || stat.mimeType !== "folder") {
      return ` Folder not found: ${target}`;
    }

    currentPath = newPath;
    const folderName = getLastPart(newPath) || "~";
    setPrompt(`admin@[${folderName}]:~#`);
    return `📂 Moved to [${folderName}]`;
  }
};

// 🔹 mkdir
COMMANDS.mkdir = {
  description: "إنشاء مجلد جديد",
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
  description: "عرض الملفات والمجلدات (مع --all و -n للبحث)",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return " Insufficient privileges.";

    let flags = { all: false, txt: false, js: false, doc: false, pdf: false, json: false };
    let searchTerm = null;
    let expectSearch = false;
    let targetPath = currentPath;

    // تحليل الوسائط
    for (let i = 0; i < args.length; i++) {
      const arg = args[i].toLowerCase();
      if (arg === "--all") flags.all = true;
      else if (arg === "-n") expectSearch = true;
      else if (arg === "--txt") flags.txt = true;
      else if (arg === "--js") flags.js = true;
      else if (arg === "--doc") flags.doc = true;
      else if (arg === "--pdf") flags.pdf = true;
      else if (arg === "--json") flags.json = true;
      else {
        if (expectSearch) {
          searchTerm = arg;
          expectSearch = false;
        } else targetPath = resolvePathCD(currentPath, arg);
      }
    }

    // تحميل محتوى المجلد
    const fetchFiles = async (path) => {
      const res = await fetch(`${TERMINAL_API_URL}?action=list&path=${path}`);
      const files = await res.json();
      return Array.isArray(files) ? files : [];
    };

    const filterByExt = (f) => {
      if (f.mimeType === "folder") return true;
      const ext = f.name.split(".").pop().toLowerCase();
      if (flags.txt && ext !== "txt") return false;
      if (flags.js && ext !== "js") return false;
      if (flags.doc && !["doc", "docx"].includes(ext)) return false;
      if (flags.pdf && ext !== "pdf") return false;
      if (flags.json && ext !== "json") return false;
      return !(flags.txt || flags.js || flags.doc || flags.pdf || flags.json);
    };

    // رسم الشجرة
    const printTree = async (path, indent = "") => {
      let files = await fetchFiles(path);
      if (searchTerm && !flags.all) {
        files = files.filter(f => f.name.toLowerCase().includes(searchTerm));
      }

      let lines = [];
      for (const f of files) {
        if (!filterByExt(f)) continue;
        const isFolder = f.mimeType === "folder";
        const name = isFolder ? `📁 [${f.name}]` : `📄 ${f.name}`;
        lines.push(indent + name);

        if (isFolder && flags.all) {
          const subPath = `${path}/${f.name}`;
          const subLines = await printTree(subPath, indent + "   ");
          lines.push(...subLines);
        }
      }
      return lines;
    };

    const output = await printTree(targetPath);
    return output.length ? output.join("\n") : " No files or folders found.";
  }
};

// 🔹 create
COMMANDS.create = {
  description: "إنشاء ملف جديد",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return " Insufficient privileges.";
    const path = args[0];
    if (!path) return "Usage: create <path>";
    const fullPath = currentPath ? `${currentPath}/${path}` : path;
    const res = await fetch(`${TERMINAL_API_URL}?action=create&path=${fullPath}`);
    return await res.text();
  }
};

// 🔹 update
COMMANDS.update = {
  description: "تحديث أو إنشاء ملف",
  restricted: true,
  action: async ({ role, args, rawInput }) => {
    if (role === "user") return " Insufficient privileges.";
    const [path, ...rest] = args;
    if (!path) return "Usage: update <path> <content>";
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
    if (role === "user") return " Insufficient privileges.";
    const path = args[0];
    if (!path) return "Usage: delete <path>";
    const fullPath = currentPath ? `${currentPath}/${path}` : path;
    const res = await fetch(`${TERMINAL_API_URL}?action=delete&path=${fullPath}`);
    return await res.text();
  }
};

// ===================================================
// 🔹 دوال مساعدة
function getLastPart(path) {
  if (!path) return "";
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1];
}

function resolvePathCD(base, target) {
  if (!base) base = "";
  const parts = base.split("/").filter(Boolean);
  const segs = target.split("/").filter(Boolean);
  for (const seg of segs) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}
