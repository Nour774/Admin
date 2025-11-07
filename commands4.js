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

// 🔸 عرض قائمة الملفات في Google Drive (متقدم)
COMMANDS.list = {
  description: "عرض الملفات مع فلترة حسب الاسم والصيغة وإظهار التفاصيل",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return " Insufficient privileges.";

    const res = await fetch(`${TERMINAL_API_URL}?action=list`);
    const files = await res.json();
    if (!Array.isArray(files) || !files.length) return " No files found.";

    // تهيئة الوسوم والبحث
    let flags = { id: false, url: false, txt: false, json: false, pdf: false, doc: false, js: false, all: false };
    let searchTerms = [];
    let expectSearch = false;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i].toLowerCase();
      if (arg === "-id") flags.id = true;
      else if (arg === "-url") flags.url = true;
      else if (arg === "--txt") flags.txt = true;
      else if (arg === "--json") flags.json = true;
      else if (arg === "--pdf") flags.pdf = true;
      else if (arg === "--doc") flags.doc = true;
      else if (arg === "--js") flags.js = true;
      else if (arg === "--all") flags.all = true;
      else if (arg === "-n") {
        expectSearch = true;
      } else {
        if (expectSearch) {
          searchTerms.push(arg.toLowerCase());
          expectSearch = false;
        } else {
          // كلمة بدون -n مسبق -> خطأ
          return " Unknown command or invalid usage";
        }
      }
    }

    // فلترة حسب الامتداد
    let filtered = files.filter(f => {
      const ext = f.name.split(".").pop().toLowerCase();
      if (flags.all) return true;
      if (flags.txt && ext !== "txt") return false;
      if (flags.json && ext !== "json") return false;
      if (flags.pdf && ext !== "pdf") return false;
      if (flags.doc && !["doc","docx"].includes(ext)) return false;
      if (flags.js && ext !== "js") return false;
      // إذا لم يُحدد أي وسم امتداد، إظهار كل الملفات
      if (!flags.txt && !flags.json && !flags.pdf && !flags.doc && !flags.js) return true;
      return true;
    });

    // فلترة البحث
    if (searchTerms.length) {
      filtered = filtered.filter(f =>
        searchTerms.every(term => f.name.toLowerCase().includes(term))
      );
    }

    // تنسيق النتائج
    const output = filtered.map(file => {
      const parts = [file.name];
      if (flags.id) parts.push(`🆔 ${file.id}`);
      if (flags.url) parts.push(`🔗 ${file.url}`);
      return parts.join(" | ");
    });

    return output.length ? output.join("\n") : " No matching files found.";
  },
};

// 🔸 قراءة ملف
COMMANDS.get = {
  description: "قراءة محتوى ملف محدد",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return " الصلاحيات غير كافية.";
    const filename = args[0];
    if (!filename) return "❗ Use: get <filename>";
    const res = await fetch(`${TERMINAL_API_URL}?action=get&name=${filename}`);
    return await res.text();
  }
};

// 🔸 إنشاء ملف فارغ (بأي صيغة)
COMMANDS.create = {
  description: "إنشاء ملف جديد فارغ",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return " الصلاحيات غير كافية.";
    const filename = args[0];
    if (!filename) return " Use: create <filename>";
    const res = await fetch(`${TERMINAL_API_URL}?action=update&name=${filename}&data={}`);
    return await res.text();
  }
};

// 🔸 تحديث أو إنشاء ملف (أي نوع)
COMMANDS.update = {
  description: "تحديث أو إنشاء ملف (حتى لو لم يوجد من قبل)",
  restricted: true,
  action: async ({ role, args, rawInput }) => {
    if (role === "user") return " الصلاحيات غير كافية.";
    const [filename, ...rest] = args;
    if (!filename) return " Use: update <filename> <content>";

    const contentStart = rawInput.indexOf(filename) + filename.length;
    const content = rawInput.slice(contentStart).trim();
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
    if (role === "user") return " الصلاحيات غير كافية.";
    const filename = args[0];
    if (!filename) return " Use: delete <filename>";
    const res = await fetch(`${TERMINAL_API_URL}?action=delete&name=${filename}`);
    return await res.text();
  }
};

// ===================================================
// ✅ الملخص:
// - user: يمكنه فقط help, echo
// - admin/root: يمكنهم list, get, create, update, delete
// - list يدعم وسوم: -n <بحث> | -id | -url | --txt | --json | --pdf | --doc | --js | --all
// - list بدون -n ثم كتابة كلمة -> يعتبر خطأ ويظهر رسالة "❌ Unknown command or invalid usage"
// - update يعمل الآن حتى لو لم تدخل محتوى، سينشئ ملفًا فارغًا تلقائيًا
// ===================================================
