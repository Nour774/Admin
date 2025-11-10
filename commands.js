/* ================================
   🔰 AdminShell Commands v1.0 (Smart Safe Build)
   Author: ChatGPT
   ================================ */

// ✅ تحقق ذكي لتجنب تكرار تعريف TERMINAL_API_URL
if (typeof TERMINAL_API_URL === "undefined") {
  var TERMINAL_API_URL = "https://script.google.com/macros/s/AKfycbynOeeI-6j04_7n8gi3RwnIccW_YnBe54dtC9XPS4E8X0bCqUNEU1CtwbZ2z1CVvn4/exec";
}

// 🧭 تعريف المسار الحالي بشكل عام (متاح لجميع الملفات)
window.currentPath = window.currentPath || "";

// 🧱 دوال مساعدة
function resolvePathCD(basePath, target) {
  if (!basePath) basePath = "";
  if (target === "..") {
    const parts = basePath.split("/").filter(Boolean);
    parts.pop();
    return parts.join("/");
  }
  if (target === "~") return "";
  return basePath ? `${basePath}/${target}`.replace(/\/+/g, "/") : target;
}

function getLastPart(path) {
  if (!path) return "";
  const parts = path.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

// ==============================
// ⚙️ قائمة الأوامر
// ==============================

const COMMANDS = {};

// 📜 list — عرض الملفات والمجلدات
COMMANDS.list = {
  description: "عرض الملفات في المجلد الحالي",
  restricted: false,
  action: async () => {
    const path = window.currentPath || "";
    try {
      const res = await fetch(`${TERMINAL_API_URL}?action=list&path=${path}`);
      const files = await res.json();

      if (!Array.isArray(files) || files.length === 0) {
        return "📂 المجلد فارغ.";
      }

      let output = `📁 المحتويات في: [${getLastPart(path) || "~"}]\n\n`;
      files.forEach(f => {
        const icon = f.mimeType === "application/vnd.google-apps.folder" ? "📁" : "📄";
        output += `${icon} ${f.name}\n`;
      });
      return output.trim();
    } catch (err) {
      return `⚠️ خطأ أثناء جلب الملفات: ${err.message}`;
    }
  }
};

// 📂 cd — تغيير المجلد الحالي
COMMANDS.cd = {
  description: "تغيير المجلد الحالي",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "❌ لا تملك صلاحية تغيير المجلد.";
    const target = args[0];
    if (!target) return "Usage: cd <folder>";

    const newPath = resolvePathCD(window.currentPath, target);
    try {
      const res = await fetch(`${TERMINAL_API_URL}?action=list&path=${newPath}`);
      const files = await res.json();

      if (!Array.isArray(files)) return `⚠️ المجلد غير موجود: ${target}`;
      const folderExists = files.some(f => f.mimeType === "application/vnd.google-apps.folder");
      if (!folderExists && files.length === 0) {
        return `❌ المجلد غير موجود: ${target}`;
      }

      window.currentPath = newPath;
      return `📂 تم الانتقال إلى [${getLastPart(newPath) || "~"}]`;
    } catch (err) {
      return `⚠️ خطأ أثناء تنفيذ cd: ${err.message}`;
    }
  }
};

// 🏗️ mkdir — إنشاء مجلد جديد
COMMANDS.mkdir = {
  description: "إنشاء مجلد جديد",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "❌ لا تملك صلاحية الإنشاء.";
    const name = args[0];
    if (!name) return "Usage: mkdir <foldername>";

    try {
      const res = await fetch(`${TERMINAL_API_URL}?action=createFolder&path=${window.currentPath}&name=${name}`);
      const data = await res.text();
      return data.includes("success") ? `📁 تم إنشاء المجلد: ${name}` : `⚠️ فشل إنشاء المجلد.`;
    } catch (err) {
      return `⚠️ خطأ أثناء الإنشاء: ${err.message}`;
    }
  }
};

// 📄 create — إنشاء ملف جديد
COMMANDS.create = {
  description: "إنشاء ملف جديد",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "❌ لا تملك صلاحية الإنشاء.";
    const name = args[0];
    if (!name) return "Usage: create <filename>";

    try {
      const res = await fetch(`${TERMINAL_API_URL}?action=createFile&path=${window.currentPath}&name=${name}`);
      const data = await res.text();
      return data.includes("success") ? `📄 تم إنشاء الملف: ${name}` : `⚠️ فشل إنشاء الملف.`;
    } catch (err) {
      return `⚠️ خطأ أثناء الإنشاء: ${err.message}`;
    }
  }
};

// ✏️ update — تحديث محتوى ملف
COMMANDS.update = {
  description: "تحديث محتوى ملف",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "❌ لا تملك صلاحية التحديث.";
    const [name, ...contentArr] = args;
    if (!name || contentArr.length === 0) return "Usage: update <filename> <new_content>";

    const content = contentArr.join(" ");
    try {
      const res = await fetch(`${TERMINAL_API_URL}?action=updateFile&path=${window.currentPath}&name=${name}&content=${encodeURIComponent(content)}`);
      const data = await res.text();
      return data.includes("success") ? `✅ تم تحديث الملف: ${name}` : `⚠️ فشل تحديث الملف.`;
    } catch (err) {
      return `⚠️ خطأ أثناء التحديث: ${err.message}`;
    }
  }
};

// ❌ delete — حذف ملف أو مجلد
COMMANDS.delete = {
  description: "حذف ملف أو مجلد",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "❌ لا تملك صلاحية الحذف.";
    const name = args[0];
    if (!name) return "Usage: delete <filename|folder>";

    try {
      const res = await fetch(`${TERMINAL_API_URL}?action=delete&path=${window.currentPath}&name=${name}`);
      const data = await res.text();
      return data.includes("success") ? `🗑️ تم الحذف: ${name}` : `⚠️ لم يتم العثور على العنصر: ${name}`;
    } catch (err) {
      return `⚠️ خطأ أثناء الحذف: ${err.message}`;
    }
  }
};

// 🔓 help — عرض قائمة الأوامر المتاحة
COMMANDS.help = {
  description: "عرض قائمة الأوامر المتاحة",
  restricted: false,
  action: () => {
    let output = "🧭 الأوامر المتاحة:\n\n";
    for (const [cmd, info] of Object.entries(COMMANDS)) {
      output += `🔸 ${cmd} — ${info.description}\n`;
    }
    return output.trim();
  }
};

// 🧾 تصدير الأوامر
export default COMMANDS;
