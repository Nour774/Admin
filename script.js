// 🌐 إعداد Supabase
const SUPABASE_URL = "https://hmamaaqtnzevrrmgtgxk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtYW1hYXF0bnpldnJybWd0Z3hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNTgzMDAsImV4cCI6MjA3NzkzNDMwMH0.tk_S2URpkYvf8xnsPJl3Dqh4jzKwhVm0alWl8oHo-SE";

// 🌐 رابط Google Apps Script Web App (TERMINAL API)
const TERMINAL_API_URL = "https://script.google.com/macros/s/AKfycbwHEpFkBld76EVE6kBTeqkn2ShdS_cSqnBU1ue1QwrCO1JSGrC3kMpGrbFt6mqcNQgg/exec";

// ⚡ تهيئة الترمنال
const term = new Terminal({
  theme: { background: '#0c0c0c', foreground: '#00ff00' },
  cursorBlink: true,
});
term.open(document.getElementById('terminal'));

// المستويات اللونية
const roles = {
  user: '#00ff00',
  admin: '#ffaa00',
  root: '#ff5555',
};

let currentRole = 'user';

// كتابة الموجه
function writePrompt() {
  const color = roles[currentRole];
  term.write(`\r\n\x1b[38;2;${hexToRgb(color)}m${currentRole}@system:${currentRole === 'user' ? '~$' : '~#'} \x1b[0m`);
}

// تحويل hex إلى RGB
function hexToRgb(hex) {
  const bigint = parseInt(hex.slice(1), 16);
  return `${(bigint >> 16) & 255};${(bigint >> 8) & 255};${bigint & 255}`;
}

// بدء الترمنال
term.writeln("🟢 AdminShell v1.0");
term.writeln("Type 'help' for available commands.");
writePrompt();

// قراءة الأوامر
let buffer = '';
term.onData(async (data) => {
  if (data.charCodeAt(0) === 13) { // Enter
    term.writeln('');
    const cmd = buffer.trim();
    buffer = '';
    await handleCommand(cmd);
    writePrompt();
  } else if (data.charCodeAt(0) === 127) { // Backspace
    if (buffer.length > 0) {
      buffer = buffer.slice(0, -1);
      term.write('\b \b');
    }
  } else {
    buffer += data;
    term.write(data);
  }
});

// تنفيذ الأوامر
async function handleCommand(cmd) {
  if (!cmd) return;
  const [command, ...args] = cmd.split(' ');
  const cmdObj = COMMANDS[command];
  if (!cmdObj) {
    term.writeln(`❌ Unknown command: ${command}`);
    return;
  }
  try {
    // ✅ تم تمرير rawInput هنا لإصلاح الخطأ
    const result = await cmdObj.action({ args, role: currentRole, switchRole, rawInput: cmd });
    if (result) term.writeln(result);
  } catch (err) {
    term.writeln(`⚠️ Error: ${err}`);
  }
}

// تبديل الصلاحية مع التحقق من كلمة المرور في Supabase
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

// إدخال كلمة مرور (تظهر على شكل نجوم)
function promptPassword(msg) {
  return new Promise(resolve => {
    let pwd = '';
    term.write(msg);
    const listener = (data) => {
      const code = data.charCodeAt(0);
      if (code === 13) {
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

// التحقق من Supabase
async function verifyPassword(role, password) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/roles?name=eq.${role}`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    const data = await res.json();
    return data.length && data[0].password === password;
  } catch {
    return false;
  }
}
