import {
  readdirSync,
  readFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import path from "node:path";
const output = [
  "Kremen Learn — Third-party license texts\n\nSee THIRD-PARTY-NOTICES.md for the distribution overview.",
];
function collect(dir, label) {
  const names = readdirSync(dir, { withFileTypes: true }).filter(
    (x) =>
      x.isFile() &&
      /^(licen[cs]e|copying|copyright|notice)([.\-_]|$)/i.test(x.name),
  );
  for (const entry of names) {
    const file = path.join(dir, entry.name);
    const text = readFileSync(file, "utf8");
    if (text.length < 300000)
      output.push(
        `\n${"=".repeat(72)}\n${label} — ${entry.name}\n${"=".repeat(72)}\n${text}`,
      );
  }
}
function packages(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const p = path.join(dir, entry.name);
    if (entry.name.startsWith("@")) packages(p);
    else if (existsSync(path.join(p, "package.json"))) {
      const pkg = JSON.parse(
        readFileSync(path.join(p, "package.json"), "utf8"),
      );
      collect(p, `npm ${pkg.name}@${pkg.version}`);
      packages(path.join(p, "node_modules"));
    }
  }
}
packages("node_modules");
const cargo = process.env.CARGO_HOME;
if (cargo && existsSync(path.join(cargo, "registry/src")))
  for (const registry of readdirSync(path.join(cargo, "registry/src"))) {
    const root = path.join(cargo, "registry/src", registry);
    for (const name of readdirSync(root)) {
      const dir = path.join(root, name);
      if (existsSync(path.join(dir, "Cargo.toml")))
        collect(dir, `Rust ${name}`);
    }
  }
mkdirSync("src-tauri/resources/legal", { recursive: true });
writeFileSync(
  "src-tauri/resources/legal/THIRD-PARTY-LICENSES.txt",
  output.join("\n"),
);
for (const file of [
  "LICENSE",
  "THIRD-PARTY-NOTICES.md",
  "THIRD-PARTY-NOTICES.ru.md",
])
  copyFileSync(file, path.join("src-tauri/resources/legal", file));
console.log(`Collected ${output.length - 1} license/notice files`);
