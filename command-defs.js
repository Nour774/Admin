// 🔹 command-defs.js
export const COMMAND_DEFS = [
  {
    name: "help",
    description: "عرض جميع الأوامر المتاحة",
    restricted: false,
    action: async ({ args, role, switchRole }) => {
      return Object.keys(COMMANDS)
        .filter(cmd => {
          const c = COMMANDS[cmd];
          if (c.restricted && role === "user") return false;
          return true;
        })
        .map(cmd => `• ${cmd} - ${COMMANDS[cmd].description}`)
        .join("\n");
    },
  },
  {
    name: "cd",
    description: "تغيير المجلد الحالي",
    restricted: true,
    action: async ({ args, role }) => {
      if (role === "user") return "❌ Insufficient privileges.";
      const target = args[0];
      if (!target) return "Usage: cd <folder>";

      const newPath = resolvePathCD(currentPath, target);

      const res = await fetch(`${TERMINAL_API_URL}?action=list&path=${newPath}`);
      const files = await res.json();
      const folderExists = files.some(f => f.mimeType === "folder" || f.mimeType === "application/vnd.google-apps.folder");
      if (!folderExists) return `❌ Folder not found: ${target}`;

      currentPath = newPath;
      return `📂 Moved to [${getLastPart(newPath) || "~"}]`;
    }
  },
  {
    name: "list",
    description: "عرض الملفات والمجلدات مع دعم البحث والمرشحات",
    restricted: true,
    action: async ({ args, role }) => {
      if (role === "user") return "❌ Insufficient privileges.";

      let flags = { all: false, txt: false, js: false, doc: false, pdf: false, json: false, id: false, url: false };
      let searchTerm = null;
      let expectSearch = false;
      let targetPath = currentPath;

      for (let arg of args) {
        arg = arg.toLowerCase();
        if (arg === "--all") flags.all = true;
        else if (arg === "--txt") flags.txt = true;
        else if (arg === "--js") flags.js = true;
        else if (arg === "--doc") flags.doc = true;
        else if (arg === "--pdf") flags.pdf = true;
        else if (arg === "--json") flags.json = true;
        else if (arg === "-id") flags.id = true;
        else if (arg === "-url") flags.url = true;
        else if (arg === "-n") expectSearch = true;
        else {
          if (expectSearch) {
            searchTerm = arg;
            expectSearch = false;
          } else {
            targetPath = resolvePathCD(currentPath, arg);
          }
        }
      }

      const fetchFiles = async (path) => {
        const res = await fetch(`${TERMINAL_API_URL}?action=list&path=${path}`);
        const files = await res.json();
        return Array.isArray(files) ? files : [];
      };

      const filterByExt = f => {
        if (f.mimeType === "folder") return flags.all || !searchTerm;
        const ext = f.name.split(".").pop().toLowerCase();
        if (flags.all) return true;
        if (flags.txt && ext !== "txt") return false;
        if (flags.js && ext !== "js") return false;
        if (flags.doc && !["doc","docx"].includes(ext)) return false;
        if (flags.pdf && ext !== "pdf") return false;
        if (flags.json && ext !== "json") return false;
        return !flags.txt && !flags.js && !flags.doc && !flags.pdf && !flags.json;
      };

      const printTree = async (path) => {
        const files = await fetchFiles(path);
        let visibleFiles = files.filter(filterByExt);
        if (searchTerm) visibleFiles = visibleFiles.filter(f => f.name.toLowerCase().includes(searchTerm));

        return visibleFiles.map(f => f.mimeType === "folder" ? `📂 [${f.name}]` : `📄 ${f.name}`);
      };

      const output = await printTree(targetPath);
      return output.length ? output.join("\n") : "📁 No matching files or folders found.";
    }
  },
  {
    name: "echo",
    description: "إعادة النص كما هو",
    restricted: false,
    action: async ({ args }) => args.join(" ")
  },
  {
    name: "exit",
    description: "العودة إلى user",
    restricted: false,
    action: async ({ role }) => {
      if (role === "admin" || role === "root") {
        currentRole = "user";
        return "🔒 Returned to user privileges.";
      } else {
        return "❗ أنت بالفعل مستخدم عادي.";
      }
    }
  },
  {
    name: "sudo",
    description: "رفع الصلاحية إلى admin",
    restricted: false,
    action: async ({ args, switchRole }) => {
      if (args[0] === "su") await switchRole("admin");
      else return "Usage: sudo su";
    }
  },
  {
    name: "su",
    description: "رفع الصلاحية إلى root",
    restricted: false,
    action: async ({ args, switchRole }) => {
      if (args[0] === "root") await switchRole("root");
      else return "Usage: su root";
    }
  }
];
