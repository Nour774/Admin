// 🔹 list (Tree View + Colors + Organized)
COMMANDS.list = {
  description: "عرض الملفات والمجلدات بطريقة شجرية منظمة",
  restricted: true,
  action: async ({ role, args }) => {
    if (role === "user") return " Insufficient privileges.";

    let flags = { all: false, txt: false, js: false, doc: false, pdf: false, json: false, id: false, url: false };
    let searchTerm = null;
    let expectSearch = false;
    let targetPath = currentPath;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i].toLowerCase();
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

    const colorize = (text, type) => {
      switch(type) {
        case 'folder': return `\x1b[34m${text}\x1b[0m`; // أزرق
        case 'file': return `\x1b[32m${text}\x1b[0m`;   // أخضر
        case 'json': return `\x1b[35m${text}\x1b[0m`;   // أرجواني
        case 'cover': return `\x1b[33m${text}\x1b[0m`;  // أصفر
        default: return text;
      }
    };

    const filterByExt = f => {
      if (f.mimeType === "folder") return true;
      const ext = f.name.split(".").pop().toLowerCase();
      if (flags.all) return true;
      if (flags.txt && ext !== "txt") return false;
      if (flags.js && ext !== "js") return false;
      if (flags.doc && !["doc","docx"].includes(ext)) return false;
      if (flags.pdf && ext !== "pdf") return false;
      if (flags.json && ext !== "json") return false;
      return !flags.txt && !flags.js && !flags.doc && !flags.pdf && !flags.json;
    };

    const printTree = async (path, prefix = "") => {
      let files = await fetchFiles(path);
      if (searchTerm && !flags.all) {
        files = files.filter(f => f.name.toLowerCase().includes(searchTerm));
      }

      // ترتيب: المجلدات أولًا
      const folders = files.filter(f => f.mimeType === "folder");
      const regularFiles = files.filter(f => f.mimeType !== "folder");

      let lines = [];

      for (let i = 0; i < folders.length; i++) {
        const f = folders[i];
        const isLast = (i === folders.length - 1 && regularFiles.length === 0);
        const branch = isLast ? '└── ' : '├── ';
        const name = colorize(f.name, 'folder');
        let line = `${prefix}${branch}📁 ${name}`;
        if (flags.id) line += ` | 🆔 ${f.id}`;
        if (flags.url) line += ` | 🔗 ${f.url}`;
        lines.push(line);

        if (flags.all) {
          const subPath = path ? `${path}/${f.name}` : f.name;
          const newPrefix = prefix + (isLast ? "    " : "│   ");
          const subLines = await printTree(subPath, newPrefix);
          lines.push(...subLines);
        }
      }

      for (let i = 0; i < regularFiles.length; i++) {
        const f = regularFiles[i];
        if (!filterByExt(f)) continue;
        const isLast = (i === regularFiles.length - 1);
        const branch = isLast ? '└── ' : '├── ';

        let type = 'file';
        if (f.name.toLowerCase() === 'cover.jpg') type = 'cover';
        else if (f.name.endsWith('.json')) type = 'json';

        const name = colorize(f.name, type);
        let line = `${prefix}${branch}📄 ${name}`;
        if (flags.id) line += ` | 🆔 ${f.id}`;
        if (flags.url) line += ` | 🔗 ${f.url}`;
        lines.push(line);
      }

      return lines;
    };

    const output = await printTree(targetPath);
    return output.length ? output.join("\n") : " No matching files or folders found.";
  }
};
