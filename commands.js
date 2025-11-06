// ===================================================
// ⚡️ AdminShell Commands - Final Version
// ===================================================

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

// 🔹 الخروج من وضع المسؤول أو الروت
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

// 🔸 عرض قائمة الملفات JSON أو أي نوع
COMMANDS.list = {
  description: "عرض جميع الملفات في Google Drive",
  restricted: true,
  action: async ({ role }) => {
    if (role === "user") return "🚫 الصلاحيات غير كافية.";
    const res = await fetch(`${TERMINAL_API_URL}?action=list`);
    return await res.text();
  }
};

// 🔸 قراءة أي ملف
COMMANDS.get = {
  description: "قراءة ملف محدد",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "🚫 الصلاحيات غير كافية.";
    const filename = args[0];
    if (!filename) return "❗ استخدم: get <filename>";
    const res = await fetch(`${TERMINAL_API_URL}?action=get&file=${filename}`);
    return await res.text();
  }
};

// 🔸 إنشاء ملف جديد (أي صيغة)
COMMANDS.create = {
  description: "إنشاء ملف جديد بأي صيغة",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "🚫 الصلاحيات غير كافية.";
    const filename = args[0];
    if (!filename) return "❗ استخدم: create <filename>";
    const res = await fetch(`${TERMINAL_API_URL}?action=create&file=${filename}`);
    return await res.text();
  }
};

// 🔸 تحديث محتوى أي ملف (يدعم JSON أو نص)
COMMANDS.update = {
  description: "تحديث محتوى ملف معين (يدعم JSON أو نص)",
  restricted: true,
  action: async ({ role, args, rawInput }) => {
    if (role === "user") return "🚫 الصلاحيات غير كافية.";

    const filename = args[0];
    if (!filename) return "❗ استخدم: update <filename> <content>";

    // ✅ الحصول على النص الأصلي بعد اسم الملف (حتى لو يحتوي على JSON)
    const jsonStart = rawInput.indexOf(filename) + filename.length;
    const contentStr = rawInput.slice(jsonStart).trim();

    if (!contentStr) return "❗ لم يتم العثور على محتوى لتحديث الملف.";

    let parsedContent = contentStr;
    try {
      // إذا كان المحتوى يبدو كـ JSON نحاول تحليله
      if (contentStr.startsWith("{") || contentStr.startsWith("[")) {
        parsedContent = JSON.parse(contentStr);
      }
    } catch (e) {
      return `⚠️ JSON غير صالح: ${e.message}`;
    }

    const res = await fetch(`${TERMINAL_API_URL}?action=update&file=${filename}`, {
      method: "POST",
      body: typeof parsedContent === "string" ? parsedContent : JSON.stringify(parsedContent, null, 2),
    });

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
    const res = await fetch(`${TERMINAL_API_URL}?action=delete&file=${filename}`);
    return await res.text();
  }
};

// ===================================================
// ✅ ملاحظات تشغيل
// ===================================================
//
// 1️⃣ user يمكنه:
//     - help
//     - echo
//
// 2️⃣ admin/root يمكنهم:
//     - list
//     - get
//     - create
//     - update
//     - delete
//     - exit
//
// 3️⃣ update الآن يقبل:
//     update file.json {"key":"value"}
//     أو
//     update notes.txt Hello world!
//     أو حتى
//     update config.json '{"theme":"dark"}'
//
// 4️⃣ create filename.ext  ← ينشئ أي ملف بأي صيغة
// ===================================================
