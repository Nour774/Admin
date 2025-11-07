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
      currentRole = "user";
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
    if (args[0] === "su") await switchRole("admin");
    else return "Usage: sudo su";
  }
};

// 🔹 رفع الصلاحية إلى root
COMMANDS.su = {
  description: "رفع الصلاحية إلى root",
  action: async ({ args, switchRole }) => {
    if (args[0] === "root") await switchRole("root");
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

// 🔸 عرض قائمة الملفات في Google Drive
COMMANDS.list = {
  description: "عرض جميع الملفات في Google Drive",
  restricted: true,
  action: async ({ role }) => {
    if (role === "user") return "🚫 الصلاحيات غير كافية.";
    const res = await fetch(`${TERMINAL_API_URL}?action=list`);
    return await res.text();
  }
};

// 🔸 قراءة ملف
COMMANDS.get = {
  description: "قراءة محتوى ملف محدد",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "🚫 الصلاحيات غير كافية.";
    const filename = args[0];
    if (!filename) return "❗ استخدم: get <filename>";
    const res = await fetch(`${TERMINAL_API_URL}?action=get&name=${filename}`);
    return await res.text();
  }
};

// 🔸 إنشاء ملف فارغ (بأي صيغة)
COMMANDS.create = {
  description: "إنشاء ملف جديد فارغ",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "🚫 الصلاحيات غير كافية.";
    const filename = args[0];
    if (!filename) return "❗ استخدم: create <filename>";
    const res = await fetch(`${TERMINAL_API_URL}?action=update&name=${filename}&data={}`);
    return await res.text();
  }
};

// 🔸 تحديث أو إنشاء ملف (أي نوع)
COMMANDS.update = {
  description: "تحديث أو إنشاء ملف (حتى لو لم يوجد من قبل)",
  restricted: true,
  action: async ({ role, args, rawInput }) => {
    if (role === "user") return "🚫 الصلاحيات غير كافية.";

    const [filename, ...rest] = args;
    if (!filename) return "❗ استخدم: update <filename> <content>";

    // 🔍 استخراج المحتوى بعد اسم الملف من النص الكامل
    const contentStart = rawInput.indexOf(filename) + filename.length;
    const content = rawInput.slice(contentStart).trim();

    // ✏️ إذا لم يُدخل المستخدم محتوى، أنشئ ملفًا فارغًا
    const safeContent = content.length ? content : "";

    const res = await fetch(
      `${TERMINAL_API_URL}?action=update&name=${filename}&data=${encodeURIComponent(safeContent)}`
    );
    return await res.text();
  }
};

// 🔸 حذف ملف
COMMANDS.delete = {
  description: "حذف ملف محدد",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "🚫 الصلاحيات غير كافية.";
    const filename = args[0];
    if (!filename) return "❗ استخدم: delete <filename>";
    const res = await fetch(`${TERMINAL_API_URL}?action=delete&name=${filename}`);
    return await res.text();
  }
};

// ===================================================
// ✅ الملخص:
// - user: يمكنه فقط help, echo
// - admin/root: يمكنهم list, get, create, update, delete
// - update يعمل الآن حتى لو لم تدخل محتوى، سينشئ ملفًا فارغًا تلقائيًا
// ===================================================
