// ============ ⚡️ AdminShell Commands (Final v2) ============

const COMMANDS = {};
let currentPath = ""; // مسار العمل الحالي

// =========================
// 🔹 مساعدة وعرض الأوامر
// =========================
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

// =========================
// 🔹 الصلاحيات
// =========================
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

// =========================
// 🔹 echo
// =========================
COMMANDS.echo = {
  description: "إعادة النص كما هو",
  action: async ({ args }) => args.join(" "),
};

// =========================
// 🔐 أوامر الإدارة
// =========================

// 🔹 تغيير المجلد الحالي
COMMANDS.cd = {
  description: "تغيير المجلد الحالي",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return " Insufficient privileges.";
    const target = args[0];
    if (!target) return "Usage: cd <folder>";
    // دعم [.] و [..]
    const newPath = resolvePathCD(currentPath, target);
    // تحقق من وجود المجلد
    const res = await fetch(`${TERMINAL_API_URL}?action=list&path=${newPath}`);
    const files = await res.json();
    if (!files.some(f => f.mimeType === "folder" && f.name.toLowerCase() === getLastPart(target).toLowerCase() )) {
      return ` Folder not found: ${target}`;
    }
    currentPath = newPath;
    return `📂 Moved to [${getLastPart(newPath) || '~'}]`;
  }
};

// 🔹 إنشاء مجلد
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

// 🔹 إنشاء ملف
COMMANDS.create = {
  description: "إنشاء ملف جديد",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return " Insufficient privileges.";
    const filePath = args[0];
    if (!filePath) return "Usage: create <path/filename>";
    const path = currentPath ? `${currentPath}/${filePath}` : filePath;
    const res = await fetch(`${TERMINAL_API_URL}?action=create&path=${path}`);
    return await res.text();
  }
};

// 🔹 تحديث أو إنشاء ملف
COMMANDS.update = {
  description: "تحديث أو إنشاء ملف بمحتوى",
  restricted: true,
  action: async ({ role, args, rawInput }) => {
    if (role === "user") return " Insufficient privileges.";
    const [filePath, ...rest] = args;
    if (!filePath) return "Usage: update <path/filename> <content>";
    const path = currentPath ? `${currentPath}/${filePath}` : filePath;
    const contentStart = rawInput.indexOf(filePath) + filePath.length;
    const content = rawInput.slice(contentStart).trim();
    const res = await fetch(`${TERMINAL_API_URL}?action=update&path=${path}&data=${encodeURIComponent(content)}`);
    return await res.text();
  }
};

// 🔹 حذف ملف أو مجلد
COMMANDS.delete = {
  description: "حذف ملف أو مجلد",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return " Insufficient privileges.";
    const filePath = args[0];
    if (!filePath) return "Usage: delete <path>";
    const path = currentPath ? `${currentPath}/${filePath}` : filePath;
    const res = await fetch(`${TERMINAL_API_URL}?action=delete&path=${path}`);
    return await res.text();
  }
};

// 🔹 عرض الملفات والمجلدات
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

    const res = await fetch(`${TERMINAL_API_URL}?action=list&path=${targetPath}`);
    let files = await res.json();
    if (!Array.isArray(files)) return " No files or folders found.";

    // فلترة حسب الامتداد
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

    // دالة recursive لطباعة الشجرة
    const printTree = (items, indent = "") => {
      let lines = [];
      items.forEach(f => {
        if (!filterByExt(f)) return;
        const isFolder = f.mimeType === "folder";
        const name = isFolder ? `📂 [${f.name}]` : `📄 ${f.name}`;
        let line = indent + name;
        if (flags.id) line += ` | 🆔 ${f.id}`;
        if (flags.url) line += ` | 🔗 ${f.url}`;
        lines.push(line);

        if (isFolder && flags.all) {
          const subRes = fetch(`${TERMINAL_API_URL}?action=list&path=${targetPath ? targetPath + "/" + f.name : f.name}`);
          const subFiles = JSON.parse(subRes.getText ? subRes.getText() : "[]");
          if (subFiles.length) lines.push(...printTree(subFiles, indent + "  "));
        }
      });
      return lines;
    };

    if (searchTerm) {
      if (!flags.all) {
        files = files.filter(f => f.name.toLowerCase().includes(searchTerm));
      } else {
        const searchTree = (items, base = "") => {
          let results = [];
          items.forEach(f => {
            const fullName = base ? `${base}/${f.name}` : f.name;
            if (f.name.toLowerCase().includes(searchTerm)) results.push(f);
            if (f.mimeType === "folder") {
              const subRes = fetch(`${TERMINAL_API_URL}?action=list&path=${targetPath ? targetPath + "/" + f.name : f.name}`);
              const subFiles = JSON.parse(subRes.getText ? subRes.getText() : "[]");
              results.push(...searchTree(subFiles, fullName));
            }
          });
          return results;
        };
        files = searchTree(files);
      }
    }

    const output = printTree(files);
    return output.length ? output.join("\n") : " No matching files or folders found.";
  }
};

// =========================
// 🔹 دوال مساعدة
// =========================
function resolvePathCD(base, target) {
  if (!target) return base;
  let parts = base ? base.split("/").filter(Boolean) : [];
  const tParts = target.split("/").filter(Boolean);
  for (const p of tParts) {
    if (p === ".") continue;
    else if (p === "..") parts.pop();
    else parts.push(p);
  }
  return parts.join("/");
}

function getLastPart(path) {
  const parts = path.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}
