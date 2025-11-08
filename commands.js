// ============ ⚡️ AdminShell Commands (Full Updated) ============
const COMMANDS = {}; // تعريف واحد فقط وآمن

// 🧭 تعريف متغيرات البيئة العامة
window.currentPath = window.currentPath || "/";
window.currentRole = window.currentRole || "user";

// 🔹 عرض الأوامر المتاحة
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
  },
};

// 🔹 أمر echo
COMMANDS.echo = {
  description: "إعادة النص كما هو",
  action: async ({ args }) => args.join(" "),
};

// 🔹 أمر clear
COMMANDS.clear = {
  description: "مسح الشاشة",
  action: async () => {
    const output = document.getElementById("terminal-output");
    if (output) output.innerHTML = "";
    return "";
  },
};

// 🔹 أمر whoami
COMMANDS.whoami = {
  description: "عرض الدور الحالي",
  action: async () => `الدور الحالي: ${window.currentRole}`,
};

// 🔹 أمر cd لتغيير المسار
COMMANDS.cd = {
  description: "تغيير المسار الحالي",
  action: async ({ args }) => {
    const path = args[0];
    if (!path) return "❌ يجب إدخال مسار.";
    window.currentPath = path;
    return `📁 تم الانتقال إلى: ${path}`;
  },
};

// 🔹 أمر sudo
COMMANDS.sudo = {
  description: "الوصول إلى صلاحيات المدير",
  action: async ({ args }) => {
    const password = args.join(" ");
    if (password === "admin123") {
      window.currentRole = "admin";
      return "✅ تم منح صلاحيات المدير.";
    }
    return "❌ كلمة مرور خاطئة.";
  },
};

// 🔹 أمر exit
COMMANDS.exit = {
  description: "الخروج من صلاحيات المدير",
  action: async () => {
    window.currentRole = "user";
    return "🚪 تم تسجيل الخروج من وضع المدير.";
  },
};

// 🔹 أمر fakepath (لإظهار المسار الحالي)
COMMANDS.pwd = {
  description: "عرض المسار الحالي",
  action: async () => `📂 المسار الحالي: ${window.currentPath}`,
};

// 🔹 تنفيذ الأوامر
async function handleCommand(input) {
  const output = document.getElementById("terminal-output");
  const [cmd, ...args] = input.trim().split(/\s+/);
  const command = COMMANDS[cmd];

  if (!command) {
    appendOutput(`❌ Unknown command: ${cmd}`);
    return;
  }

  // التحقق من الصلاحيات
  if (command.restricted && window.currentRole !== "admin") {
    appendOutput("⛔ هذا الأمر مخصص للمدير فقط.");
    return;
  }

  try {
    const result = await command.action({ args, role: window.currentRole });
    if (result) appendOutput(result);
  } catch (err) {
    appendOutput(`⚠️ خطأ أثناء تنفيذ الأمر: ${err.message}`);
  }
}

// 🔹 دالة لطباعة النتائج
function appendOutput(text) {
  const output = document.getElementById("terminal-output");
  if (!output) return;
  const line = document.createElement("div");
  line.textContent = text;
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
}

// 🔹 حدث الإدخال (Enter)
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("terminal-input");
  if (!input) return;

  input.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      const command = input.value.trim();
      appendOutput(`> ${command}`);
      input.value = "";
      await handleCommand(command);
    }
  });
});
