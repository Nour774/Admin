// ============ ⚡️ AdminShell (Stable v3) ============

// الحالة العامة للنظام
let currentPath = "";        // المسار الحالي
let currentRole = "user";    // الوضع الحالي
const TERMINAL_API_URL = "https://your-api-endpoint.com"; // غيّر هذا إلى عنوان سكربتك

// تعريف الأوامر
const COMMANDS = {};

// ===================================================
// 🧩 أوامر عامة
// ===================================================

COMMANDS.help = {
  description: "عرض جميع الأوامر المتاحة",
  action: async ({ role }) => {
    return Object.keys(COMMANDS)
      .filter(cmd => !COMMANDS[cmd].restricted || role !== "user")
      .map(cmd => `• ${cmd} - ${COMMANDS[cmd].description}`)
      .join("\n");
  }
};

// ===================================================
// 🔐 الصلاحيات
// ===================================================

COMMANDS.sudo = {
  description: "رفع الصلاحية إلى admin",
  action: async ({ args }) => {
    if (args[0] !== "su") return "Usage: sudo su";
    currentRole = "admin";
    return "✅ Switched to ADMIN mode.";
  }
};

COMMANDS.exit = {
  description: "العودة إلى user",
  action: async () => {
    currentRole = "user";
    return "🔒 Returned to user privileges.";
  }
};

// ===================================================
// 📂 التنقل وإنشاء المجلدات
// ===================================================

COMMANDS.cd = {
  description: "تغيير المجلد الحالي",
  restricted: true,
  action: async ({ args }) => {
    if (currentRole === "user") return " Insufficient privileges.";

    const target = args[0];
    if (!target) return "Usage: cd <folder>";

    const newPath = resolvePathCD(currentPath, target);

    const res = await fetch(`${TERMINAL_API_URL}?action=list&path=${newPath}`);
    const files = await res.json();

    if (!Array.isArray(files)) return ` Folder not found: ${target}`;

    currentPath = newPath;
    return `📂 Moved to [${getLastPart(newPath) || '~'}]`;
  }
};

COMMANDS.mkdir = {
  description: "إنشاء مجلد جديد",
  restricted: true,
  action: async ({ args }) => {
    if (currentRole === "user") return " Insufficient privileges.";
    const name = args[0];
    if (!name) return "Usage: mkdir <name>";

    const path = currentPath ? `${currentPath}/${name}` : name;
    const res = await fetch(`${TERMINAL_API_URL}?action=mkdir&path=${path}`);
    return await res.text();
  }
};

// ===================================================
// 📜 عرض الملفات (list)
// ===================================================

COMMANDS.list = {
  description: "عرض الملفات والمجلدات (يدعم --all و -n)",
  restricted: true,
  action: async ({ args }) => {
    if (currentRole === "user") return " Insufficient privileges.";

    let flags = { all: false };
    let searchTerm = null;
    let targetPath = currentPath;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === "--all") flags.all = true;
      else if (arg === "-n") searchTerm = args[i + 1];
      else if (!arg.startsWith("-")) targetPath = resolvePathCD(currentPath, arg);
    }

    const fetchFiles = async (path) => {
      const res = await fetch(`${TERMINAL_API_URL}?action=list&path=${path}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    };

    const printTree = async (path, prefix = "") => {
      const files = await fetchFiles(path);
      let output = [];

      for (const f of files) {
        const isFolder = f.mimeType === "folder";
        if (searchTerm && !f.name.toLowerCase().includes(searchTerm.toLowerCase())) continue;

        const icon = isFolder ? "📁" : "📄";
        const color = isFolder ? "\x1b[36m" : "\x1b[37m";
        output.push(`${prefix}${color}${icon} ${f.name}\x1b[0m`);

        if (isFolder && flags.all) {
          const subPath = path ? `${path}/${f.name}` : f.name;
          const subOutput = await printTree(subPath, prefix + "   ");
          output.push(...subOutput);
        }
      }
      return output;
    };

    const result = await printTree(targetPath);
    return result.length ? result.join("\n") : " No files found.";
  }
};

// ===================================================
// 🧾 إنشاء وتحديث الملفات
// ===================================================

COMMANDS.create = {
  description: "إنشاء ملف جديد",
  restricted: true,
  action: async ({ args }) => {
    if (currentRole === "user") return " Insufficient privileges.";
    const fileName = args[0];
    if (!fileName) return "Usage: create <fileName>";
    const fullPath = currentPath ? `${currentPath}/${fileName}` : fileName;
    const res = await fetch(`${TERMINAL_API_URL}?action=create&path=${fullPath}`);
    return await res.text();
  }
};

COMMANDS.update = {
  description: "تحديث أو إنشاء ملف بمحتوى جديد",
  restricted: true,
  action: async ({ args, rawInput }) => {
    if (currentRole === "user") return " Insufficient privileges.";
    const [fileName, ...contentParts] = args;
    if (!fileName) return "Usage: update <file> <content>";
    const content = contentParts.join(" ");
    const fullPath = currentPath ? `${currentPath}/${fileName}` : fileName;
    const res = await fetch(`${TERMINAL_API_URL}?action=update&path=${fullPath}&data=${encodeURIComponent(content)}`);
    return await res.text();
  }
};

// ===================================================
// 🗑️ حذف الملفات أو المجلدات
// ===================================================

COMMANDS.delete = {
  description: "حذف ملف أو مجلد",
  restricted: true,
  action: async ({ args }) => {
    if (currentRole === "user") return " Insufficient privileges.";
    const name = args[0];
    if (!name) return "Usage: delete <path>";
    const fullPath = currentPath ? `${currentPath}/${name}` : name;
    const res = await fetch(`${TERMINAL_API_URL}?action=delete&path=${fullPath}`);
    return await res.text();
  }
};

// ===================================================
// 🧠 دوال مساعدة
// ===================================================

function getLastPart(path) {
  if (!path) return "";
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

function resolvePathCD(base, target) {
  if (!target) return base;
  if (target === "/") return "";
  const baseParts = base.split("/").filter(Boolean);
  const segments = target.split("/").filter(Boolean);
  for (const seg of segments) {
    if (seg === "..") baseParts.pop();
    else if (seg !== ".") baseParts.push(seg);
  }
  return baseParts.join("/");
}
