// =================== commands.js (Final Drive-integrated) ===================
// يفترض أن المتغيرات التالية موجودة في script.js:
// - term, roles, currentRole, TERMINAL_API_URL, hexToRgb, switchRole, promptPassword
// كما يفترض أن handleCommand في script.js يستدعي COMMANDS[cmd].action({...})

const COMMANDS = {};
let currentPath = ""; // يمثل المسار الحالي كسلسلة: "" تعني الجذر (root أو drive root)

// ------------------ دوال مساعدة ------------------

function resolvePathCD(base, target) {
  // يعالج absolute و relative و .. و .
  if (!target) return base || "";
  if (target.startsWith("/")) {
    // مسار مطلق — نزيل / البداية
    return target.replace(/^\/+/, "");
  }
  const baseParts = base ? base.split("/").filter(Boolean) : [];
  const segs = target.split("/").filter(Boolean);
  for (const s of segs) {
    if (s === "..") baseParts.pop();
    else if (s === ".") continue;
    else baseParts.push(s);
  }
  return baseParts.join("/");
}

function getDisplayPath() {
  return currentPath || "~";
}

function fmtFolder(f) {
  return `📂 [${f}]`;
}
function fmtFile(f) {
  return `📄 ${f}`;
}

// تحويل نتائج الـ API (متوقعة آررا من عناصر تحتوي name, mimeType, id, url)
function isFolderItem(item) {
  return item.mimeType === "folder" || item.mimeType === "application/vnd.google-apps.folder";
}

// استدعاء API للقائمة لمسار معين
async function apiList(path) {
  const p = encodeURIComponent(path || "");
  const res = await fetch(`${TERMINAL_API_URL}?action=list&path=${p}`);
  // نتوقع JSON array أو خطأ -> نتعامل معه بصورة آمنة
  try {
    const j = await res.json();
    if (Array.isArray(j)) return j;
    return [];
  } catch {
    return [];
  }
}

// دالة لبناء شجرة نصية (رموز: ├── └── │  )
async function buildTree(path, indent = "") {
  const items = await apiList(path);
  if (!items || items.length === 0) return "";
  // نرتب المجلدات أولًا ثم الملفات لعرض مرتب
  const folders = items.filter(isFolderItem).sort((a,b)=>a.name.localeCompare(b.name));
  const files = items.filter(it => !isFolderItem(it)).sort((a,b)=>a.name.localeCompare(b.name));
  const all = [...folders, ...files];
  let out = "";
  for (let i = 0; i < all.length; i++) {
    const it = all[i];
    const last = i === all.length - 1;
    const connector = last ? "└── " : "├── ";
    out += indent + connector + it.name + (isFolderItem(it) ? "/" : "") + "\n";
    if (isFolderItem(it)) {
      const sub = await buildTree((path ? path + "/" : "") + it.name, indent + (last ? "    " : "│   "));
      if (sub) out += sub;
    }
  }
  return out;
}

// ------------------ أوامر عامة ------------------

// help
COMMANDS.help = {
  description: "عرض جميع الأوامر المتاحة",
  action: async ({ role }) => {
    return Object.keys(COMMANDS)
      .filter(k => {
        const c = COMMANDS[k];
        if (c.restricted && role === "user") return false;
        return true;
      })
      .map(k => `• ${k} — ${COMMANDS[k].description}`)
      .join("\n");
  }
};

// echo
COMMANDS.echo = {
  description: "إعادة النص كما هو",
  action: async ({ args }) => args.join(" "),
};

// clear
COMMANDS.clear = {
  description: "مسح شاشة التيرمنال",
  action: async () => {
    term.clear();
    return null;
  }
};

// pwd
COMMANDS.pwd = {
  description: "عرض المسار الحالي",
  action: async () => `📂 ${getDisplayPath()}`,
};

// ------------------ أوامر صلاحيات (تتطلب admin/root) ------------------

// cd
COMMANDS.cd = {
  description: "تغيير المجلد الحالي. استخدام: cd <folder> أو cd ..",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "❌ Insufficient privileges.";
    const target = args[0];
    if (!target) return `📂 ${getDisplayPath()}`;

    const newPath = resolvePathCD(currentPath, target);

    // نتحقق من وجود المجلد عبر API: نطلب قائمة المجلد الأب ثم نبحث
    // حالة الدخول إلى "/" أو "" -> نسمح
    if (!newPath) {
      currentPath = "";
      return `📂 تم الانتقال إلى [~]`;
    }

    // عند محاولة الوصول إلى مجلد موجود، نتأكد من أنه مجلد:
    // احصل على قائمة المجلد الأب
    const parent = newPath.split("/").slice(0, -1).join("/");
    const name = newPath.split("/").slice(-1)[0];
    const list = await apiList(parent);
    const found = list.find(it => it.name === name && isFolderItem(it));
    if (!found) {
      return `❌ Folder not found: ${target}`;
    }

    currentPath = newPath;
    return `📂 تم الانتقال إلى [${currentPath || "~"}]`;
  }
};

// mkdir
COMMANDS.mkdir = {
  description: "إنشاء مجلد جديد: mkdir <folderName>",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "❌ Insufficient privileges.";
    const folderName = args[0];
    if (!folderName) return "Usage: mkdir <folderName>";
    const path = currentPath ? `${currentPath}/${folderName}` : folderName;
    const res = await fetch(`${TERMINAL_API_URL}?action=mkdir&path=${encodeURIComponent(path)}`);
    return await res.text();
  }
};

// create (ملف جديد)
COMMANDS.create = {
  description: "إنشاء ملف جديد: create <path/filename>",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "❌ Insufficient privileges.";
    const path = args[0];
    if (!path) return "Usage: create <path/filename>";
    const fullPath = currentPath ? `${currentPath}/${path}` : path;
    const res = await fetch(`${TERMINAL_API_URL}?action=create&path=${encodeURIComponent(fullPath)}`);
    return await res.text();
  }
};

// update (تحديث محتوى)
COMMANDS.update = {
  description: "تحديث أو إنشاء ملف: update <path/filename> <content>",
  restricted: true,
  action: async ({ role, args, rawInput }) => {
    if (role === "user") return "❌ Insufficient privileges.";
    const [path, ...rest] = args;
    if (!path) return "Usage: update <path/filename> <content>";
    const contentStart = rawInput.indexOf(path) + path.length;
    const content = rawInput.slice(contentStart).trim();
    const fullPath = currentPath ? `${currentPath}/${path}` : path;
    const res = await fetch(`${TERMINAL_API_URL}?action=update&path=${encodeURIComponent(fullPath)}&data=${encodeURIComponent(content)}`);
    return await res.text();
  }
};

// delete
COMMANDS.delete = {
  description: "حذف ملف أو مجلد: delete <path>",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "❌ Insufficient privileges.";
    const path = args[0];
    if (!path) return "Usage: delete <path>";
    const fullPath = currentPath ? `${currentPath}/${path}` : path;
    const res = await fetch(`${TERMINAL_API_URL}?action=delete&path=${encodeURIComponent(fullPath)}`);
    return await res.text();
  }
};

// list / ls
COMMANDS.list = {
  description: "عرض الملفات والمجلدات. أمثلة: list, list --all, list --txt -n keyword -p folderName",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return "❌ Insufficient privileges.";

    // تحليل الوسوم والوسيط الأخير قد يكون مسار/مجلد
    let flags = {
      all: false, txt: false, js: false, doc: false, pdf: false, json: false, showPath: false
    };
    let searchFile = null;   // -n
    let searchFolder = null; // +n
    let targetPath = currentPath;

    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (!a) continue;
      if (a === '--all') flags.all = true;
      else if (a === '--txt') flags.txt = true;
      else if (a === '--js') flags.js = true;
      else if (a === '--doc') flags.doc = true;
      else if (a === '--pdf') flags.pdf = true;
      else if (a === '--json') flags.json = true;
      else if (a === '-p') flags.showPath = true;
      else if (a === '-n') {
        searchFile = (args[++i] || "").toLowerCase();
      } else if (a === '+n') {
        searchFolder = (args[++i] || "").toLowerCase();
      } else {
        // إذا كان وسيطاً غير وسم → نعتبره مسارًا أو مجلدًا
        targetPath = resolvePathCD(currentPath, a);
      }
    }

    // إذا طلبت شجرة كاملة
    if (flags.all) {
      const tree = await buildTree(targetPath);
      return tree || "📂 [Empty directory]";
    }

    // جلب عناصر المجلد المستهدف
    const items = await apiList(targetPath);
    if (!items || items.length === 0) return "📂 [Empty directory]";

    // فلترة حسب النوع (الامتدادات)
    function extMatch(name) {
      const ext = (name.split('.').pop() || '').toLowerCase();
      if (flags.txt) return ext === 'txt';
      if (flags.js) return ext === 'js';
      if (flags.doc) return ['doc','docx'].includes(ext);
      if (flags.pdf) return ext === 'pdf';
      if (flags.json) return ext === 'json';
      return true;
    }

    // بناء المخرجات بالترتيب: مجلدات أولًا ثم ملفات
    const folders = items.filter(isFolderItem).sort((a,b)=>a.name.localeCompare(b.name));
    const files = items.filter(it => !isFolderItem(it)).sort((a,b)=>a.name.localeCompare(b.name));

    let outLines = [];

    // مجلدات — تنطبق عليها فلترة searchFolder إذا وُجدت
    for (const f of folders) {
      if (searchFile) continue; // -n يستهدف الملفات → تجاهل المجلدات
      if (searchFolder && !f.name.toLowerCase().includes(searchFolder)) continue;
      const line = flags.showPath ? `${fmtFolder(f.name)} (${(targetPath?targetPath+"/":"")+f.name})` : fmtFolder(f.name);
      outLines.push(line);
    }

    // ملفات — تنطبق عليها فلترة searchFile و extMatch
    for (const f of files) {
      if (searchFolder) continue; // +n يستهدف المجلدات → تجاهل الملفات
      if (searchFile && !f.name.toLowerCase().includes(searchFile)) continue;
      if (!extMatch(f.name)) continue;
      const line = flags.showPath ? `${fmtFile(f.name)} (${(targetPath?targetPath+"/":"")+f.name})` : fmtFile(f.name);
      outLines.push(line);
    }

    return outLines.length ? outLines.join("\n") : "📁 لا توجد ملفات أو مجلدات مطابقة.";
  }
};

// sudo
COMMANDS.sudo = {
  description: "sudo su — طلب صلاحية admin",
  action: async ({ args, switchRole }) => {
    if (args[0] === 'su') {
      await switchRole('admin');
      return `✅ Requested admin.`;
    }
    return "Usage: sudo su";
  }
};

// su
COMMANDS.su = {
  description: "su root — طلب صلاحية root",
  action: async ({ args, switchRole }) => {
    if (args[0] === 'root') {
      await switchRole('root');
      return `✅ Requested root.`;
    }
    return "Usage: su root";
  }
};

// exit
COMMANDS.exit = {
  description: "العودة إلى دور المستخدم العادي",
  action: async ({ role }) => {
    if (role === 'admin' || role === 'root') {
      currentRole = 'user';
      return "🔒 Returned to user privileges.";
    }
    return "❗ أنت بالفعل مستخدم عادي.";
  }
};

// =================== إعادة تعريف الموجه لعرض المسار الحالي ===================
// نقوم بإعادة تعريف writePrompt (الموجود في script.js) ليعرض المسار قبل كل إدخال.

if (typeof writePrompt === "function") {
  // نحفظ النسخة الأصلية تحسباً لاحق
  const _origWritePrompt = writePrompt;
  writePrompt = function () {
    const color = roles[currentRole] || '#00ff00';
    const rgb = hexToRgb(color); // يُعيد "r;g;b"
    const displayPath = getDisplayPath();
    // نكتب بداية سطر جديدة ثم الموجه
    term.write(`\r\n\x1b[38;2;${rgb}m${currentRole}@system:${displayPath}${currentRole === 'user' ? '$' : '#'} \x1b[0m `);
  };
} else {
  // إن لم تكن موجودة مسبقاً، نعرفها هنا
  writePrompt = function () {
    const color = roles[currentRole] || '#00ff00';
    const rgb = hexToRgb(color);
    const displayPath = getDisplayPath();
    term.write(`\r\n\x1b[38;2;${rgb}m${currentRole}@system:${displayPath}${currentRole === 'user' ? '$' : '#'} \x1b[0m `);
  };
}

// =================== تصدير/تعريف عام ===================
// handleCommand في script.js يتوقع وجود COMMANDS متاحًا عالميًا.
window.COMMANDS = COMMANDS;
