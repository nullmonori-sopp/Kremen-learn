import { cpSync, mkdirSync, existsSync } from "node:fs";
mkdirSync("public/content", { recursive: true });
if (existsSync("content"))
  cpSync("content", "public/content", { recursive: true });
