// ============ ⚡️ AdminShell Commands (Enhanced) ============

const COMMANDS = {};

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

// 🔸 إنشاء مجلد
COMMANDS.mkdir = {
  description: "إنشاء مجلد جديد في Google Drive",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return " Insufficient privileges.";
    const folderName = args[0];
    if (!folderName) return "Usage: mkdir <folderName>";

    const res = await fetch(`${TERMINAL_API_URL}?action=mkdir&path=${folderName}`);
    return await res.text();
  }
};

// 🔸 عرض الملفات (يدعم المسار والمجلدات)
COMMANDS.list = {
  description: "عرض الملفات والمجلدات",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return " Insufficient privileges.";

    const targetPath = args.find(a => !a.startsWith("-") && !a.startsWith("--") && !a.startsWith("-n"));
    const res = await fetch(`${TERMINAL_API_URL}?action=list&path=${targetPath || ""}`);
    const files = await res.json();

    if (!Array.isArray(files) || !files.length) return " No files or folders found.";

    let flags = { id: false, url: false, all: false, txt: false, js: false, doc: false, pdf: false, json: false };
    let searchTerms = [];
    let expectSearch = false;

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
          return " Unknown command or invalid usage";
        }
      }
    }

    let filtered = files.filter(f => {
      if (f.mimeType === "folder") return true; // أظهر المجلدات دائمًا
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
      filtered = filtered.filter(f =>
        searchTerms.every(term => f.name.toLowerCase().includes(term))
      );
    }

    return filtered.map(f => {
      const parts = [f.name + (f.mimeType === "folder" ? "/" : "")];
      if (flags.id) parts.push(`🆔 ${f.id}`);
      if (flags.url) parts.push(`🔗 ${f.url}`);
      return parts.join(" | ");
    }).join("\n");
  }
};

// 🔸 إنشاء ملف
COMMANDS.create = {
  description: "إنشاء ملف جديد (يدعم المسارات)",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return " Insufficient privileges.";
    const path = args[0];
    if (!path) return "Usage: create <path/filename>";
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
    const [path, ...rest] = args;
    if (!path) return "Usage: update <path/filename> <content>";

    const contentStart = rawInput.indexOf(path) + path.length;
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
    const path = args[0];
    if (!path) return "Usage: delete <path>";
    const res = await fetch(`${TERMINAL_API_URL}?action=delete&path=${path}`);
    return await res.text();
  }
};
