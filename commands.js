import React, { useEffect, useRef, useState } from 'react';

/* Admin Shell — Web App (Single-file React component)

Default export a React component that provides a full web terminal UI

Uses in-memory VirtualFS and TerminalEngine (adapted from the previous file)

Tailwind CSS assumed for styling (no import required)

Features:

User/admin/root roles with sudo/su

Protected paths containing 'root' or 'admin'

list --all and filter flags

nano editor modal (interactive)

File tree viewer, console output, command input

Ability to toggle between in-memory VFS and a mock remote API

Simple session log and command history



Usage:

Put this file into a React project (create-react-app / Next.js) and render <AdminShellWebApp />

Ensure Tailwind or basic CSS is available, or adapt styles */


// ------------------ VirtualFS & TerminalAPI (copied/embedded) ------------------ class VirtualFS { constructor() { this.nodes = {}; this._init(); } _init() { this.nodes[''] = { type: 'folder', name: '', children: new Set() }; this.mkdir('@Root#'); this.mkdir('home'); this.mkdir('home/user'); this.create('home/user/readme.txt', 'Welcome to AdminShell Web'); } normalize(path) { if (!path) return ''; path = path.replace(/^/+|/+$/g, ''); const parts = path.split('/').filter(Boolean); const stack = []; for (const p of parts) { if (p === '.') continue; if (p === '..') stack.pop(); else stack.push(p); } return stack.join('/'); } join(base, target) { if (!target) return this.normalize(base); if (target.startsWith('/')) return this.normalize(target); const baseParts = this.normalize(base).split('/').filter(Boolean); const targetParts = target.split('/').filter(Boolean); const parts = baseParts.concat(targetParts); return this.normalize(parts.join('/')); } exists(path) { return this.nodes.hasOwnProperty(this.normalize(path)); } isProtectedNameComponent(name) { const lower = name.toLowerCase(); return lower.includes('root') || lower.includes('admin'); } isProtectedPath(path) { if (!path) return false; const parts = this.normalize(path).split('/').filter(Boolean); for (const p of parts) if (this.isProtectedNameComponent(p)) return true; return false; } mkdir(path) { const p = this.normalize(path); if (!p) return false; if (this.exists(p)) return false; const parts = p.split('/'); const name = parts.pop(); const parent = parts.join('/'); if (!this.exists(parent)) return false; this.nodes[p] = { type: 'folder', name, children: new Set() }; this.nodes[parent].children.add(name); return true; } create(path, content = '') { const p = this.normalize(path); const parts = p.split('/').filter(Boolean); if (parts.length === 0) return false; const name = parts.pop(); const parent = parts.join('/'); if (!this.exists(parent)) return false; this.nodes[p] = { type: 'file', name, content }; this.nodes[parent].children.add(name); return true; } update(path, content) { const p = this.normalize(path); if (!this.exists(p)) return false; if (this.nodes[p].type !== 'file') return false; this.nodes[p].content = content; return true; } delete(path) { const p = this.normalize(path); if (!this.exists(p)) return false; if (p === '') return false; const parts = p.split('/'); const name = parts.pop(); const parent = parts.join('/'); if (this.nodes[p].type === 'folder' && this.nodes[p].children.size > 0) return false; delete this.nodes[p]; if (this.nodes[parent]) this.nodes[parent].children.delete(name); return true; } list(path) { const p = this.normalize(path); if (!this.exists(p)) return null; const node = this.nodes[p]; if (node.type !== 'folder') return null; const children = Array.from(node.children).map(name => { const childPath = p ? ${p}/${name} : name; const child = this.nodes[this.normalize(childPath)]; if (!child) return null; return { name: child.name, type: child.type, path: childPath, mimeType: child.type === 'folder' ? 'folder' : 'file', id: this._hashPath(childPath), url: vfs://${childPath} }; }).filter(Boolean); return children; } readFile(path) { const p = this.normalize(path); if (!this.exists(p)) return null; if (this.nodes[p].type !== 'file') return null; return this.nodes[p].content; } _hashPath(path) { let h = 0; for (let i = 0; i < path.length; i++) { h = ((h << 5) - h) + path.charCodeAt(i); h |= 0; } return id_${Math.abs(h)}; } }

const TerminalAPI = { vfs: new VirtualFS(), async fetch(action, path, options = {}) { const vfs = this.vfs; switch (action) { case 'list': return vfs.list(path); case 'mkdir': return vfs.mkdir(path) ? { ok: true } : { ok: false, msg: 'mkdir failed' }; case 'create': return vfs.create(path, options.data || '') ? { ok: true } : { ok: false, msg: 'create failed' }; case 'update': return vfs.update(path, options.data || '') ? { ok: true } : { ok: false, msg: 'update failed' }; case 'delete': return vfs.delete(path) ? { ok: true } : { ok: false, msg: 'delete failed' }; case 'read': return { ok: true, data: vfs.readFile(path) }; default: return { ok: false, msg: 'unknown action' }; } } };

// ------------------ Terminal Engine (same as before but simplified) ------------------ class TerminalEngine { constructor({ api = TerminalAPI, input = null, output = null } = {}) { this.api = api; this.currentPath = ''; this.role = 'user'; this.input = input; this.output = output || (() => {}); this.commands = {}; this._registerCoreCommands(); } _resolvePath(target) { return this.api.vfs.join(this.currentPath, target); } _isProtectedPath(path) { return this.api.vfs.isProtectedPath(path); } async runLine(raw) { if (!raw || !raw.trim()) return ''; const parsed = this._parseRaw(raw); const cmd = parsed.cmd; const handler = this.commands[cmd]; if (!handler) return ❌ Unknown command: ${cmd}; try { const res = await handler.action({ role: this.role, args: parsed.args, flags: parsed.flags, rawInput: raw, engine: this }); return res; } catch (e) { return ❗ Error executing ${cmd}: ${e.message}; } } _parseRaw(raw) { const tokens = []; let cur = ''; let inQuote = false; for (let i = 0; i < raw.length; i++) { const ch = raw[i]; if (ch === '"') { inQuote = !inQuote; continue; } if (!inQuote && /\s/.test(ch)) { if (cur) { tokens.push(cur); cur = ''; } } else cur += ch; } if (cur) tokens.push(cur); const cmd = tokens.shift(); const flags = {}; const args = []; for (const t of tokens) { if (t.startsWith('--')) flags[t.slice(2)] = true; else if (t.startsWith('-')) flags[t.slice(1)] = true; else args.push(t); } return { cmd, args, flags }; } switchRole(newRole) { if (['user', 'admin', 'root'].includes(newRole)) { this.role = newRole; return true; } return false; } _registerCoreCommands() { const C = this.commands; C.help = { description: 'عرض جميع الأوامر المتاحة', action: async ({ role }) => Object.keys(this.commands).filter(k => { const c = this.commands[k]; if (c.restricted && role === 'user') return false; return true; }).map(k => • ${k} - ${this.commands[k].description || ''}).join('\n') }; C.exit = { description: 'العودة إلى user من admin/root', action: async ({ role }) => { if (role === 'admin' || role === 'root') { this.switchRole('user'); return '🔒 Returned to user privileges.'; } else return '❗ أنت بالفعل مستخدم عادي.'; } }; C.sudo = { description: 'رفع الصلاحية إلى admin (sudo su)', action: async ({ args }) => { if (args[0] === 'su') { this.switchRole('admin'); return '🔓 Privilege: admin'; } return 'Usage: sudo su'; } }; C.su = { description: 'رفع الصلاحية إلى root (su root) — يتطلب admin', action: async ({ args, role }) => { if (args[0] !== 'root') return 'Usage: su root'; if (role !== 'admin') return '❌ su root يتطلب أن تكون admin أولاً.'; this.switchRole('root'); return '🔱 Privilege: root'; } }; C.echo = { description: 'إعادة النص كما هو', action: async ({ args }) => args.join(' ') };

C.cd = { description: 'تغيير المجلد الحالي (يدعم مسارات نسبية ومطلقة)', restricted: true, action: async ({ role, args }) => { if (role === 'user') return '❌ Insufficient privileges.'; const target = args[0] || ''; const newPath = this._resolvePath(target); const files = await this.api.fetch('list', newPath); if (!Array.isArray(files)) return `❌ Folder not found: ${target}`; if (this.api.vfs.isProtectedPath(newPath) && role !== 'root') return '❌ This path requires root privileges.'; this.currentPath = newPath; return `📂 Current path: /${this.currentPath || ''}`; } };
C.mkdir = { description: 'إنشاء مجلد جديد في المسار المحدد', restricted: true, action: async ({ role, args }) => { if (role === 'user') return '❌ Insufficient privileges.'; const folderName = args[0]; if (!folderName) return 'Usage: mkdir <folderName> or mkdir <path/to/folder>'; const target = this._resolvePath(folderName); if (this._isProtectedPath(target) && role !== 'root') return '❌ Cannot create protected folder without root.'; const res = await this.api.fetch('mkdir', target); return res.ok ? `✅ Folder created: /${target}` : `❌ Failed to create folder: ${res.msg || ''}`; } };
C.create = { description: 'إنشاء ملف جديد (create path/filename)', restricted: true, action: async ({ role, args }) => { if (role === 'user') return '❌ Insufficient privileges.'; const path = args[0]; if (!path) return 'Usage: create <path/filename>'; const full = this._resolvePath(path); if (this._isProtectedPath(full) && role !== 'root') return '❌ Cannot create inside protected path.'; const res = await this.api.fetch('create', full, { data: '' }); return res.ok ? `✅ File created: /${full}` : `❌ Failed: ${res.msg || ''}`; } };
C.update = { description: 'تحديث أو إنشاء ملف (update path content...)', restricted: true, action: async ({ role, args, rawInput }) => { if (role === 'user') return '❌ Insufficient privileges.'; const [path] = args; if (!path) return 'Usage: update <path/filename> <content>'; const contentStart = rawInput.indexOf(path) + path.length; const content = rawInput.slice(contentStart).trim(); const full = this._resolvePath(path); if (this._isProtectedPath(full) && role !== 'root') return '❌ Cannot update protected path.'; if (!this.api.vfs.exists(full) || this.api.vfs.nodes[this.api.vfs.normalize(full)].type !== 'file') { const cr = await this.api.fetch('create', full, { data: content }); return cr.ok ? `✅ File created: /${full}` : `❌ Failed to create file`; } const res = await this.api.fetch('update', full, { data: content }); return res.ok ? `✅ File updated: /${full}` : `❌ Failed to update`; } };
C.delete = { description: 'حذف ملف أو مجلد (المجلد يجب أن يكون فارغًا)', restricted: true, action: async ({ role, args }) => { if (role === 'user') return '❌ Insufficient privileges.'; const path = args[0]; if (!path) return 'Usage: delete <path>'; const full = this._resolvePath(path); if (this._isProtectedPath(full) && role !== 'root') return '❌ Cannot delete protected path.'; const res = await this.api.fetch('delete', full); return res.ok ? `✅ Deleted: /${full}` : `❌ Failed to delete (maybe folder not empty or not exists)`; } };
C.read = { description: 'قراءة محتوى ملف (read path/file.txt)', restricted: true, action: async ({ role, args }) => { if (role === 'user') return '❌ Insufficient privileges.'; const path = args[0]; if (!path) return 'Usage: read <path/filename>'; const full = this._resolvePath(path); if (this._isProtectedPath(full) && role !== 'root') return '❌ Cannot read protected path.'; const res = await this.api.fetch('read', full); return res.ok ? res.data || '' : `❌ Failed to read file`; } };

C.list = { description: 'عرض الملفات والمجلدات مع دعم البحث والفلترة والمسارات', restricted: true, action: async ({ role, args, flags }) => { if (role === 'user') return '❌ Insufficient privileges.'; const filterFlags = { all: !!flags.all, txt: !!flags.txt, js: !!flags.js, doc: !!flags.doc, pdf: !!flags.pdf, json: !!flags.json, id: !!flags.id, url: !!flags.url, filesOnly: !!flags.n }; let targetPath = this.currentPath; let searchTerm = null; if (args.length > 0) { const maybePath = args[0]; if (maybePath.includes('/') || maybePath.startsWith('/')) { targetPath = this._resolvePath(maybePath); if (args[1]) searchTerm = args[1]; } else { const asPath = this._resolvePath(maybePath); if (this.api.vfs.exists(asPath) && this.api.vfs.nodes[this.api.vfs.normalize(asPath)].type === 'folder') { targetPath = asPath; if (args[1]) searchTerm = args[1]; } else { searchTerm = maybePath; if (args[1]) { const asPath2 = this._resolvePath(args[1]); if (this.api.vfs.exists(asPath2)) targetPath = asPath2; } } } }
  if (this._isProtectedPath(targetPath) && role !== 'root') return '❌ This path requires root privileges.';
  const fetchFiles = async (path) => { const files = await this.api.fetch('list', path); return Array.isArray(files) ? files : []; };
  const matchesFilter = (f) => { const isFolder = f.mimeType === 'folder'; if (filterFlags.filesOnly && isFolder) return false; if (filterFlags.txt && !f.name.endsWith('.txt')) return false; if (filterFlags.js && !f.name.endsWith('.js')) return false; if (filterFlags.doc && !(/\.docx?$/.test(f.name))) return false; if (filterFlags.pdf && !f.name.endsWith('.pdf')) return false; if (filterFlags.json && !f.name.endsWith('.json')) return false; if (searchTerm && !f.name.toLowerCase().includes(searchTerm.toLowerCase())) return false; return true; };
  const printTree = async (path, indent = '') => { let files = await fetchFiles(path); files = files.filter(matchesFilter); let lines = []; for (const f of files) { const isFolder = f.mimeType === 'folder'; const name = isFolder ? `📂 [${f.name}]` : `📄 ${f.name}`; let line = indent + name; if (filterFlags.id) line += ` | 🆔 ${f.id}`; if (filterFlags.url) line += ` | 🔗 ${f.url}`; lines.push(line); if (isFolder && filterFlags.all) { const subPath = path ? `${path}/${f.name}` : f.name; const subLines = await printTree(subPath, indent + '  '); lines.push(...subLines); } } return lines; };
  const output = await printTree(targetPath);
  return output.length ? output.join('\n') : '📁 No files or folders found.';
} };

C.nano = { description: 'محرر نصي بسيط: nano <path>', restricted: true, action: async ({ role, args }) => { if (role === 'user') return '❌ Insufficient privileges.'; const path = args[0]; if (!path) return 'Usage: nano <path>'; const full = this._resolvePath(path); if (this._isProtectedPath(full) && role !== 'root') return '❌ Cannot edit protected path.'; if (!this.input) return '❌ nano requires an interactive input callback provided to the engine.'; let current = ''; if (this.api.vfs.exists(full) && this.api.vfs.nodes[this.api.vfs.normalize(full)].type === 'file') { current = this.api.fetch('read', full).data || ''; } const newContent = await this.input({ type: 'nano', path: full, content: current }); if (typeof newContent !== 'string') return '❌ nano aborted or invalid content returned.'; if (!this.api.vfs.exists(full) || this.api.vfs.nodes[this.api.vfs.normalize(full)].type !== 'file') { await this.api.fetch('create', full, { data: newContent }); return `✅ File created: /${full}`; } else { await this.api.fetch('update', full, { data: newContent }); return `✅ File updated: /${full}`; } } };

C.whoami = { description: 'إظهار الدور الحالي والمسار', action: async () => `role=${this.role} | path=/${this.currentPath}` };
C.addcmd = { description: 'إضافة أمر جديد برمجياً: addcmd name restricted(true|false)', restricted: true, action: async ({ role, args }) => { if (role !== 'root' && role !== 'admin') return '❌ Only admin/root can add commands.'; const name = args[0]; const restricted = args[1] === 'true'; if (!name) return 'Usage: addcmd <name> <restricted:true|false>'; this.commands[name] = { description: 'User added command', restricted, action: async () => `✅ ${name} executed` }; return `✅ Command added: ${name}`; } };
C.vfsreset = { description: 'Reset virtual filesystem (root only)', restricted: true, action: async ({ role }) => { if (role !== 'root') return '❌ Requires root.'; this.api.vfs = new VirtualFS(); return '✅ VFS reset.'; } };

} }

// ------------------ React UI Component ------------------ export default function AdminShellWebApp() { const [engine] = useState(() => new TerminalEngine({})); const [output, setOutput] = useState([]); const [input, setInput] = useState(''); const [role, setRole] = useState('user'); const [path, setPath] = useState('/'); const [history, setHistory] = useState([]); const [histIndex, setHistIndex] = useState(null); const [nanoOpen, setNanoOpen] = useState(false); const [nanoContent, setNanoContent] = useState(''); const [nanoPath, setNanoPath] = useState(''); const outRef = useRef(null);

useEffect(() => { // wire input callback for nano engine.input = async (ctx) => { if (ctx.type === 'nano') { setNanoPath(ctx.path); setNanoContent(ctx.content || ''); setNanoOpen(true); // wait for modal to close and return new content return await new Promise(resolve => { const unsub = engine._nanoResolve = (val) => { resolve(val); delete engine._nanoResolve; }; }); } return null; }; engine.output = (msg) => appendOutput(typeof msg === 'string' ? msg : JSON.stringify(msg)); setRole(engine.role); setPath('/'); }, [engine]);

useEffect(() => { if (outRef.current) outRef.current.scrollTop = outRef.current.scrollHeight; }, [output]);

const appendOutput = (line) => setOutput(o => [...o, line]);

const run = async (line) => { appendOutput($ ${line}); const res = await engine.runLine(line); if (res !== undefined && res !== null) appendOutput(res.toString()); setRole(engine.role); setPath(/${engine.currentPath}); setHistory(h => [line, ...h].slice(0, 200)); setHistIndex(null); };

const handleSubmit = async (e) => { e.preventDefault(); if (!input.trim()) return; await run(input.trim()); setInput(''); };

const handleKeyDown = (e) => { if (e.key === 'ArrowUp') { if (history.length === 0) return; const idx = histIndex === null ? 0 : Math.min(history.length - 1, histIndex + 1); setHistIndex(idx); setInput(history[idx]); e.preventDefault(); } else if (e.key === 'ArrowDown') { if (history.length === 0) return; if (histIndex === null) { setInput(''); return; } const idx = histIndex - 1; if (idx < 0) { setHistIndex(null); setInput(''); } else { setHistIndex(idx); setInput(history[idx]); } e.preventDefault(); } };

const openNanoSave = async () => { if (engine._nanoResolve) engine._nanoResolve(nanoContent); setNanoOpen(false); setNanoContent(''); setNanoPath(''); }; const openNanoCancel = async () => { if (engine._nanoResolve) engine._nanoResolve(null); setNanoOpen(false); setNanoContent(''); setNanoPath(''); };

const quickList = async (target = '') => { const cmd = list --all ${target}.trim(); await run(cmd); };

return ( <div className="min-h-screen bg-gray-900 text-gray-100 p-4 font-sans"> <div className="max-w-6xl mx-auto grid grid-cols-12 gap-4"> <div className="col-span-4 bg-gray-800 rounded-lg p-3 shadow"> <h2 className="text-xl font-semibold">AdminShell — File Tree</h2> <div className="mt-2 text-sm">Role: <strong>{role}</strong></div> <div className="mt-2 text-sm">Path: <strong>{path}</strong></div> <div className="mt-3 flex gap-2"> <button onClick={() => { engine.runLine('sudo su'); setRole(engine.role); appendOutput('Command: sudo su'); }} className="px-2 py-1 rounded bg-yellow-600">sudo su</button> <button onClick={() => { engine.runLine('su root'); setRole(engine.role); appendOutput('Command: su root'); }} className="px-2 py-1 rounded bg-red-600">su root</button> <button onClick={() => { engine.runLine('exit'); setRole(engine.role); appendOutput('Command: exit'); }} className="px-2 py-1 rounded bg-green-600">exit</button> </div>

<div className="mt-4">
        <button onClick={() => quickList('')} className="w-full py-2 rounded bg-blue-600">List --all (current)</button>
        <button onClick={() => quickList('home')} className="w-full py-2 rounded bg-blue-500 mt-2">List --all home</button>
        <button onClick={async () => { const res = await engine.runLine('whoami'); appendOutput(res); }} className="w-full py-2 rounded bg-indigo-600 mt-2">Whoami</button>
      </div>

      <div className="mt-4 text-sm">
        <div className="font-medium">Quick actions</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button onClick={async () => { appendOutput(await engine.runLine('mkdir demo')); }} className="p-2 rounded bg-gray-700">mkdir demo</button>
          <button onClick={async () => { appendOutput(await engine.runLine('create demo/hello.txt')); }} className="p-2 rounded bg-gray-700">create demo/hello.txt</button>
          <button onClick={async () => { appendOutput(await engine.runLine('update demo/hello.txt Hello from web')); }} className="p-2 rounded bg-gray-700">update file</button>
          <button onClick={async () => { appendOutput(await engine.runLine('read demo/hello.txt')); }} className="p-2 rounded bg-gray-700">read file</button>
        </div>
      </div>

    </div>

    <div className="col-span-8 bg-gray-800 rounded-lg p-3 shadow flex flex-col">
      <div className="flex-1 overflow-auto mb-3" ref={outRef} style={{ maxHeight: '60vh' }}>
        <div ref={outRef} className="whitespace-pre-wrap font-mono text-sm p-2" style={{ minHeight: '220px' }}>
          {output.length === 0 ? <div className="text-gray-400">Console output will appear here. Try: <code>sudo su</code> then <code>list --all</code></div> : output.map((o, i) => <div key={i} className="mb-1">{o}</div>)}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} className="flex-1 bg-gray-900 border border-gray-700 rounded p-2 font-mono" placeholder="اكتب الأمر ثم اضغط Enter" />
        <button type="submit" className="px-4 py-2 rounded bg-emerald-600">Run</button>
      </form>

      <div className="mt-2 text-xs text-gray-400">History: {history.length} commands. Use ↑ ↓ to navigate.</div>
    </div>
  </div>

  {/* Nano modal */}
  {nanoOpen && (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60">
      <div className="w-3/4 bg-gray-800 p-4 rounded shadow-xl">
        <div className="flex justify-between items-center">
          <div className="font-semibold">nano — {nanoPath}</div>
          <div className="text-sm text-gray-400">Press Save or Cancel</div>
        </div>
        <textarea value={nanoContent} onChange={e => setNanoContent(e.target.value)} className="w-full h-64 mt-3 bg-gray-900 p-2 font-mono" />
        <div className="mt-3 flex gap-2 justify-end">
          <button onClick={openNanoCancel} className="px-3 py-1 rounded bg-red-600">Cancel</button>
          <button onClick={openNanoSave} className="px-3 py-1 rounded bg-green-600">Save</button>
        </div>
      </div>
    </div>
  )}

  <div className="max-w-6xl mx-auto mt-6 text-sm text-gray-400">
    <div>Notes:</div>
    <ul className="list-disc ml-6 mt-2">
      <li>Protected names: any path component containing <code>root</code> or <code>admin</code> hides content from admin/user and requires <strong>root</strong>.</li>
      <li>To reset VFS as root: <code>vfsreset</code> (root only)</li>
      <li>To edit a file with nano: <code>nano path/to/file.txt</code> (opens modal)</li>
    </ul>
  </div>
</div>

); }
