// ============ ⚡️ AdminShell Commands ============

const COMMANDS = {};

// 🔹 عرض جميع الأوامر المتاحة
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

// 🔹 أمر الخروج من وضع المسؤول أو الروت
COMMANDS.exit = {
  description: "العودة إلى user",
  action: async ({ role }) => {
    if (role === "admin" || role === "root") {
      currentRole = "user"; // ✅ إعادة الصلاحية فعليًا
      return "🔒 Returned to user privileges.";
    } else {
      return "❗ أنت بالفعل مستخدم عادي.";
    }
  }
};

// 🔹 رفع الصلاحية إلى admin
COMMANDS.sudo = {
  description: "رفع الصلاحية إلى admin",
  action: async ({ args, switchRole }) => {
    if (args[0] === 'su') await switchRole('admin');
    else return "Usage: sudo su";
  }
};

// 🔹 رفع الصلاحية إلى root
COMMANDS.su = {
  description: "رفع الصلاحية إلى root",
  action: async ({ args, switchRole }) => {
    if (args[0] === 'root') await switchRole('root');
    else return "Usage: su root";
  }
};

// 🔹 طباعة النص كما هو
COMMANDS.echo = {
  description: "إعادة النص كما هو",
  action: async ({ args }) => args.join(" "),
};

// ===================================================
// 🔐 أوامر الإدارة (خاصة بـ admin و root فقط)
// ===================================================

// 🔸 عرض قائمة الملفات JSON في Google Drive
COMMANDS.list = {
  description: "عرض جميع ملفات JSON في Google Drive",
  restricted: true,
  action: async ({ role }) => {
    if (role === "user") return "🚫 الصلاحيات غير كافية.";
    const res = await fetch(`${TERMINAL_API_URL}?action=list`);
    return await res.text();
  }
};

// 🔸 قراءة ملف JSON
COMMANDS.get = {
  description: "قراءة ملف JSON محدد",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "🚫 الصلاحيات غير كافية.";
    const filename = args[0];
    if (!filename) return "❗ استخدم: get <filename>";
    const res = await fetch(`${TERMINAL_API_URL}?action=get&file=${filename}`);
    return await res.text();
  }
};

// 🔸 إنشاء ملف JSON جديد
COMMANDS.create = {
  description: "إنشاء ملف JSON جديد",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "🚫 الصلاحيات غير كافية.";
    const filename = args[0];
    if (!filename) return "❗ استخدم: create <filename>";
    const res = await fetch(`${TERMINAL_API_URL}?action=create&file=${filename}`);
    return await res.text();
  }
};

// 🔸 تحديث ملف JSON بمحتوى جديد
COMMANDS.update = {
  description: "تحديث محتوى ملف JSON",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "🚫 الصلاحيات غير كافية.";
    const [filename, ...contentArr] = args;
    if (!filename || contentArr.length === 0)
      return "❗ استخدم: update <filename> <json_content>";
    const content = contentArr.join(" ");
    const res = await fetch(`${TERMINAL_API_URL}?action=update&file=${filename}`, {
      method: "POST",
      body: content,
    });
    return await res.text();
  }
};

// 🔸 حذف ملف JSON
COMMANDS.delete = {
  description: "حذف ملف JSON",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "🚫 الصلاحيات غير كافية.";
    const filename = args[0];
    if (!filename) return "❗ استخدم: delete <filename>";
    const res = await fetch(`${TERMINAL_API_URL}?action=delete&file=${filename}`);
    return await res.text();
  }
};

// ===================================================
// ✅ ملاحظات:
// - user يمكنه فقط: help, echo
// - admin/root يمكنهم استخدام كل أوامر JSON
// - exit يعمل فعليًا ويعيد role إلى user
// - SYSTEM API = TERMINAL_API_URL (Google Apps Script)
// ===================================================
