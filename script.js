// 🌐 إعداد Supabase
const SUPABASE_URL = "https://hmamaaqtnzevrrmgtgxk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtYW1hYXF0bnpldnJybWd0Z3hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNTgzMDAsImV4cCI6MjA3NzkzNDMwMH0.tk_S2URpkYvf8xnsPJl3Dqh4jzKwhVm0alWl8oHo-SE";

// 🌐 رابط Google Apps Script Web App (TERMINAL API)
const TERMINAL_API_URL = "https://script.google.com/macros/s/AKfycbwHEpFkBld76EVE6kBTeqkn2ShdS_cSqnBU1ue1QwrCO1JSGrC3kMpGrbFt6mqcNQgg/exec";

// ⚡ تهيئة الترمنال
const term = new Terminal({
  theme: {
    background: '#0c0c0c',
    foreground: '#00ff00'
  },
  cursorBlink: true,
});
term.open(document.getElementById('terminal'));

// 🧠 نظام الألوان حسب الرتبة
const roles = {
  user: '#00ff00',
  admin: '#ffaa00',
  root: '#ff5555',
};
let currentRole = 'user';

// 🎨 موجه الأوامر
function writePrompt() {
  const color = roles[currentRole];
  term.write(`\r\n\x1b[38;2;${hexToRgb(color)}m${currentRole}@system:${currentRole === 'user' ? '~$' : '~#'} \x1b[0m`);
}

function hexToRgb(hex) {
  const bigint = parseInt(hex.slice(1), 16);
  return `${(bigint >> 16) & 255};${(bigint >> 8) & 255};${bigint & 255}`;
}

// 🚀 بدء الترمنال
term.writeln("🟢 AdminShell v1.0");
term.writeln("Type 'help' for available commands.");
writePrompt();

// 🧠 نظام إدخال ذكي (كلمات مرور + أوامر)
let buffer = '';
let passwordMode = false;
let passwordResolver = null;

term.onData(async (data) => {
  const code = data.charCodeAt(0);

  // ↩️ Enter
  if (code === 13) {
    term.writeln('');
    const input = buffer.trim();
    buffer = '';

    if (passwordMode) {
      passwordMode = false;
      if (passwordResolver) {
        const resolver = passwordResolver;
        passwordResolver = null;
        resolver(input);
      }
      return;
    }

    await handleCommand(input);
    writePrompt();
    return;
  }

  // ⌫ Backspace
  if (code === 127) {
    if (buffer.length > 0) {
      buffer = buffer.slice(0, -1);
      term.write('\b \b');
    }
    return;
  }

  // 🔒 وضع كلمة المرور
  if (passwordMode) {
    buffer += data;
    term.write('*');
    return;
  }

  // 💬 الوضع العادي
  buffer += data;
  term.write(data);
});

// 📥 دالة إدخال كلمة المرور
function promptPassword(msg) {
  return new Promise(resolve => {
    buffer = '';
    passwordMode = true;
    passwordResolver = resolve;
    term.write(msg);
  });
}

// ⚙️ تنفيذ الأوامر
async function handleCommand(cmd) {
  if (!cmd) return;
  const parts = cmd.split(' ').filter(x => x.trim() !== '');
  const [command, ...args] = parts;

  const cmdObj = COMMANDS[command];
  if (!cmdObj) {
    term.writeln(`❌ Unknown command: ${command}`);
    return;
  }

  try {
    const result = await cmdObj.action({ args, role: currentRole, switchRole, rawInput: cmd });
    if (result) term.writeln(result);
  } catch (err) {
    term.writeln(`⚠️ Error: ${err}`);
  }
}

// 🔑 تبديل الصلاحية
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

// 🧩 التحقق من كلمة المرور من Supabase
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

// 💾 تخزين مؤقت للملفات في الذاكرة
window.files = {};

// 🧱 أوامر النظام
const COMMANDS = {
  help: {
    description: 'List available commands',
    action: async () => {
      return Object.keys(COMMANDS)
        .map(cmd => `- ${cmd}: ${COMMANDS[cmd].description}`)
        .join('\n');
    }
  },
  create: {
    description: 'Create a new file (usage: create <filename>)',
    action: async ({ args }) => {
      if (!args || args.length === 0) return '❌ Usage: create <filename>';
      const filename = args[0];
      if (window.files[filename]) return `❌ File "${filename}" already exists.`;
      window.files[filename] = '';
      return `✅ File "${filename}" created.`;
    }
  },
  write: {
    description: 'Write content to a file (usage: write <filename> <text>)',
    action: async ({ args }) => {
      if (args.length < 2) return '❌ Usage: write <filename> <text>';
      const filename = args[0];
      const text = args.slice(1).join(' ');
      if (!window.files[filename]) return `❌ File "${filename}" not found.`;
      window.files[filename] = text;
      return `✅ Written to "${filename}".`;
    }
  },
  read: {
    description: 'Read file content (usage: read <filename>)',
    action: async ({ args }) => {
      if (!args.length) return '❌ Usage: read <filename>';
      const filename = args[0];
      if (!window.files[filename]) return `❌ File "${filename}" not found.`;
      return `📄 ${filename}:\n${window.files[filename]}`;
    }
  },
  delete: {
    description: 'Delete a file (usage: delete <filename>)',
    action: async ({ args }) => {
      if (!args.length) return '❌ Usage: delete <filename>';
      const filename = args[0];
      if (!window.files[filename]) return `❌ File "${filename}" not found.`;
      delete window.files[filename];
      return `🗑️ File "${filename}" deleted.`;
    }
  },
  list: {
    description: 'List all created files',
    action: async () => {
      const files = Object.keys(window.files);
      return files.length ? files.join('\n') : '📂 No files found.';
    }
  },
  clear: {
    description: 'Clear the terminal screen',
    action: async () => {
      term.clear();
      return '';
    }
  }
};
