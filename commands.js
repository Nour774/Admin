// ============ ⚡️ AdminShell Commands (Full Enhanced) ============
const COMMANDS = {};

// 🌐 المجلد الحالي
let currentPath = "/"; // empty string يعني ROOT_FOLDER_ID

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

// 🔹 دالة مساعدة لتحويل مسار cd نسبي
function resolvePathCD(base, input) {
  if (!input || input === ".") return base;
  let parts = base ? base.split("/") : [];
  const inputParts = input.split("/").filter(Boolean);

  for (const p of inputParts) {
    if (p === "..") parts.pop();
    else if (p !== ".") parts.push(p);
  }
  return parts.join("/");
}

// 🔹 دالة مساعدة لعرض الملفات بشكل شجري من Google Drive API
function formatTree(files, level = 0) {
  const indent = "   ".repeat(level);
  let output = "";
  files.forEach(f => {
    if (f.mimeType === "folder") {
      output += `${indent}📁 [${f.name}]\n`;
      if (f.children && f.children.length > 0) {
        output += formatTree(f.children, level + 1);
      }
    } else {
      output += `${indent}📄 ${f.name}\n`;
    }
  });
  return output;
}

// 🔸 تغيير المجلد الحالي
COMMANDS.cd = {
  description: "تغيير المجلد الحالي",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return " Insufficient privileges.";
    const folderName = args[0];
    if (!folderName) return "Usage: cd <folderName>";

    const newPath = resolvePathCD(currentPath, folderName);
    try {
      const res = await fetch(`${TERMINAL_API_URL}?action=list&path=${newPath}`);
      const files = await res.json();
      const folderExists = folderName === ".." || folderName === "." || files.some(f => f.mimeType === "folder");
      if (!folderExists) return ` Folder not found: ${folderName}`;
      currentPath = newPath;
      return `📂 Moved to [${currentPath || "~"}]`;
    } catch (err) {
      return `⚠️ Error: ${err}`;
    }
  }
};

// 🔸 عرض الملفات والمجلدات
COMMANDS.list = {
  description: "عرض الملفات والمجلدات",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return " Insufficient privileges.";

    let flags = { id: false, url: false, all: false, txt: false, js: false, doc: false, pdf: false, json: false };
    let searchTerms = [];
    let expectSearch = false;

    // تحليل الوسوم والكلمات
    for (let i = 0; i < args.length; i++) {
      const arg = args[i].toLowerCase();
      if (arg === "-id") flags.id = true;
      else if (arg === "-url") flags.url = true;
      else if (arg === "--all") flags.all = true;
      else if (arg === "--txt") flags.txt = true;
      else if (arg === "--js") flags.js = true;
      else if (arg === "--doc") flags.doc = true;
      else if (arg === "--pdf") flags.pdf = true;
      else if (arg === "--json") flags.json = true;
      else if (arg === "-n") expectSearch = true;
      else {
        if (expectSearch) {
          searchTerms.push(arg.toLowerCase());
          expectSearch = false;
        } else {
          // إذا كتبت كلمة بدون -n مسبق، البحث فقط في المجلد الحالي
          searchTerms.push(arg.toLowerCase());
        }
      }
    }

    const path = currentPath || "";
    try {
      const res = await fetch(`${TERMINAL_API_URL}?action=list&path=${path}`);
      const files = await res.json();
      if (!Array.isArray(files) || !files.length) return "📭 No files or folders.";

      let filtered = files.filter(f => {
        if (f.mimeType === "folder") return true;
        const ext = f.name.split(".").pop().toLowerCase();
        if (flags.all) return true;
        if (flags.txt && ext !== "txt") return false;
        if (flags.js && ext !== "js") return false;
        if (flags.doc && !["doc", "docx"].includes(ext)) return false;
        if (flags.pdf && ext !== "pdf") return false;
        if (flags.json && ext !== "json") return false;
        return !flags.txt && !flags.js && !flags.doc && !flags.pdf && !flags.json;
      });

      if (searchTerms.length) {
        if (!flags.all) {
          filtered = filtered.filter(f =>
            searchTerms.every(term => f.name.toLowerCase().includes(term))
          );
        } else {
          // بحث داخل كل الشجرة
          // نحتاج API لتدعم children
        }
      }

      return formatTree(filtered);
    } catch (err) {
      return `⚠️ Error: ${err}`;
    }
  }
};

// 🔸 إنشاء مجلد
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

// 🔸 إنشاء ملف
COMMANDS.create = {
  description: "إنشاء ملف جديد (يدعم المسارات)",
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

// 🔸 تحديث أو إنشاء ملف بمحتوى
COMMANDS.update = {
  description: "تحديث أو إنشاء ملف (يدعم المسارات)",
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

// 🔸 حذف ملف أو مجلد
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
