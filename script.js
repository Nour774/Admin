// ================================
// ⚡️ AdminShell Frontend Script
// ================================

// 🌐 إعداد API (Google Apps Script Endpoint)
const TERMINAL_API_URL = "https://script.google.com/macros/s/AKfycbwHEpFkBld76EVE6kBTeqkn2ShdS_cSqnBU1ue1QwrCO1JSGrC3kMpGrbFt6mqcNQgg/exec";

// ⚙️ إعداد Supabase (اختياري للمصادقة)
const SUPABASE_URL = "https://hmamaaqtnzevrrmgtgxk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtYW1hYXF0bnpldnJybWd0Z3hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNTgzMDAsImV4cCI6MjA3NzkzNDMwMH0.tk_S2URpkYvf8xnsPJl3Dqh4jzKwhVm0alWl8oHo-SE";

// 🎨 تهيئة واجهة الترمنال
const term = new Terminal({
  theme: { background: '#0c0c0c', foreground: '#00ff00' },
  cursorBlink: true,
});
term.open(document.getElementById('terminal'));

// 🎭 المستويات اللونية حسب الدور
const roles = {
  user: '#00ff00',
  admin: '#ffaa00',
  root: '#ff5555',
};

let currentRole = 'user';

// ================================
// 🟢 بدء الترمنال
// ================================
term.writeln("🟢 AdminShell v1.0");
term.writeln("Type 'help' for available commands.");
writePrompt();

// كتابة الموجه
function writePrompt() {
  const color = roles[currentRole];
  const rgb = hexToRgb(color);
  term.write(`\r\n\x1b[38;2;${rgb}m${currentRole}@system:${currentRole === 'user' ? '~$' : '~#'} \x1b[0m `);
}

// تحويل hex إلى RGB
function hexToRgb(hex) {
  const bigint = parseInt(hex.slice(1), 16);
  return `${(bigint >> 16) & 255};${(bigint >> 8) & 255};${bigint & 255}`;
}

// ================================
// 🎧 معالجة إدخال المستخدم
// ================================
let buffer = '';
term.onData(async (data) => {
  const code = data.charCodeAt(0);

  if (code === 13) { // Enter
    term.writeln('');
    const cmd = buffer.trim();
    buffer = '';
    await handleCommand(cmd);
    writePrompt();

  } else if (code === 127) { // Backspace
    if (buffer.length > 0) {
      buffer = buffer.slice(0, -1);
      term.write('\b \b');
    }

  } else {
    buffer += data;
    term.write(data);
  }
});

// ================================
// 🧠 تنفيذ الأوامر
// ================================
async function handleCommand(rawInput) {
  if (!rawInput) return;

  const [command, ...args] = rawInput.split(' ');
  const cmdObj = COMMANDS[command];
  if (!cmdObj) {
    term.writeln(`❌ Unknown command: ${command}`);
    return;
  }

  try {
    const result = await cmdObj.action({
      args,
      rawInput,
      role: currentRole,
      switchRole,
    });
    if (result) term.writeln(result);
  } catch (err) {
    term.writeln(`⚠️ Error: ${err.message || err}`);
  }
}

// ================================
// 🔑 تبديل الصلاحية (user → admin → root)
// ================================
async function switchRole(role) {
  const pass = await promptPassword(`Password for ${role}: `);
  const valid = await verifyPassword(role, pass);
  if (valid) {
    currentRole = role;
    term.writeln(`✅ Switched to ${role.toUpperCase()} mode.`);
  } else {
    term.writeln("❌ Wrong password.");
  }
}

// ================================
// 🔒 إدخال كلمة مرور (نجوم *)
// ================================
function promptPassword(msg) {
  return new Promise(resolve => {
    let pwd = '';
    term.write(msg);

    const listener = (data) => {
      const code = data.charCodeAt(0);

      if (code === 13) { // Enter
        term.offData(listener);
        term.writeln('');
        resolve(pwd);

      } else if (code === 127 && pwd.length > 0) {
        pwd = pwd.slice(0, -1);
        term.write('\b \b');

      } else {
        pwd += data;
        term.write('*');
      }
    };

    term.onData(listener);
  });
}

// ================================
// 🧩 التحقق من كلمة المرور عبر Supabase أو fallback
// ================================
async function verifyPassword(role, password) {
  try {
    // إذا لم تضبط Supabase، استخدم كلمات مرور ثابتة محلياً
    if (SUPABASE_URL.includes("YOUR_SUPABASE_PROJECT")) {
      const defaults = { admin: "admin123", root: "root123" };
      return password === defaults[role];
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/roles?name=eq.${role}`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });
    const data = await res.json();
    return data.length && data[0].password === password;
  } catch {
    return false;
  }
}
