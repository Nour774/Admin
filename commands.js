// 🔹 commands.js
import { COMMAND_DEFS } from './command-defs.js';

export const COMMANDS = {};

// تحميل كل التعريفات من ملف command-defs.js
COMMAND_DEFS.forEach(def => {
  COMMANDS[def.name] = def;
});

// 🔹 دوال مساعدة مشتركة
export function getLastPart(path) {
  if (!path) return "";
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

export function resolvePathCD(base, target) {
  if (!target) return base || "";
  if (target.startsWith("/")) return target; // مسار مطلق
  let parts = base.split("/").filter(Boolean);
  const segments = target.split("/").filter(Boolean);
  for (const seg of segments) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}
