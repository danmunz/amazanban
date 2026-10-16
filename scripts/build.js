#!/usr/bin/env node
// Packages extension/ into dist/amazanban-<version>.zip for the Chrome Web Store.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const extDir = path.join(root, "extension");
const manifest = JSON.parse(fs.readFileSync(path.join(extDir, "manifest.json"), "utf8"));
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

if (manifest.version !== pkg.version) {
  console.error(`Version mismatch: manifest.json is ${manifest.version}, package.json is ${pkg.version}.`);
  process.exit(1);
}

const distDir = path.join(root, "dist");
fs.mkdirSync(distDir, { recursive: true });
const out = path.join(distDir, `amazanban-${manifest.version}.zip`);
fs.rmSync(out, { force: true });

execFileSync("zip", ["-r", "-X", out, ".", "-x", ".*", "-x", "*/.*"], { cwd: extDir, stdio: "inherit" });
console.log(`\nBuilt ${path.relative(root, out)}`);
