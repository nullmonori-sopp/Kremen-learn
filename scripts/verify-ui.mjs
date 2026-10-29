/** Browser-only UI verification. Native execution is tested by the Rust suite. */
import { chromium } from "playwright-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const root = path.resolve("out");
const types = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".md": "text/markdown",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".png": "image/png",
};
const server = http.createServer((req, res) => {
  let file = path.resolve(
    root,
    "." + decodeURIComponent(req.url.split("?")[0]),
  );
  if (!file.startsWith(root + path.sep) && file !== root) {
    res.writeHead(403).end();
    return;
  }
  try {
    if (fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    res.setHeader(
      "Content-Type",
      types[path.extname(file)] || "application/octet-stream",
    );
    res.end(fs.readFileSync(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1366, height: 768 },
    reducedMotion: "reduce",
  });
  const errors = [];
  const external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (
      !r.url().startsWith(url) &&
      !r.url().startsWith("data:") &&
      !r.url().startsWith("blob:")
    )
      external.push(r.url());
  });
  await page.goto(url);
  await page.locator(".course-card").first().waitFor();
  assert.equal(await page.locator(".course-card").count(), 6);
  await page.screenshot({ path: "artifacts/preview-home.png" });
  await page.getByRole("button", { name: "Переключить тему" }).click();
  await page.screenshot({ path: "artifacts/preview-light.png" });
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  await page.getByRole("button", { name: "Переключить тему" }).click();
  await page.locator(".course-card").first().click();
  await page.locator(".course-hero").waitFor();
  await page.screenshot({ path: "artifacts/preview-course.png" });
  await page.locator(".course-cta button").first().click();
  await page.locator(".monaco-editor").waitFor();
  await page.screenshot({ path: "artifacts/preview-lesson.png" });
  await page.locator(".monaco-editor textarea").focus();
  await page.keyboard.press("Control+Enter");
  await page.locator(".toast").waitFor();
  assert.match(
    await page.locator(".toast").innerText(),
    /Desktop runtime required/,
  );
  await page.locator(".monaco-editor textarea").focus();
  await page.keyboard.press("Control+a");
  const editedSource = 'package main\nfunc main() { println("edited") }\n';
  await page.keyboard.insertText(editedSource);
  await page.waitForFunction((expected) => {
    const saved = localStorage.getItem("kremen.previewSession");
    return saved && JSON.parse(saved).files["main.kr"] === expected;
  }, editedSource);
  assert.equal(await page.locator(".output-body .stderr").count(), 0);
  await page.keyboard.press("Control+k");
  await page.getByRole("dialog").waitFor();
  await page.getByPlaceholder("Что хочется изучить?").fill("первая");
  assert.ok((await page.locator(".search-results button").count()) > 0);
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  for (const label of [
    "Главная",
    "Курсы",
    "Практика",
    "Мои проекты",
    "Справочник",
    "Настройки",
  ]) {
    await page
      .locator(".sidebar nav")
      .getByRole("button", { name: label, exact: true })
      .click();
    await page.locator(".page-heading").waitFor();
  }
  await page.locator(".language-button").click();
  assert.ok(
    (await page.locator(".sidebar nav").allTextContents())
      .join(" ")
      .includes("Settings"),
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  fs.writeFileSync(
    "artifacts/ui-validation.json",
    JSON.stringify(
      {
        viewport: "1366x768",
        reducedMotion: true,
        courseCards: 6,
        monaco: true,
        editorInputAndAutosave: true,
        staleResultCleared: true,
        monacoRunShortcut: true,
        themeSwitch: true,
        courseNavigation: true,
        searchKeyboard: true,
        navigationSections: 6,
        languageSwitch: true,
        nativePreviewError: true,
        pageErrors: errors,
        externalRequests: external,
      },
      null,
      2,
    ),
  );
  console.log("UI verification passed; screenshots saved in artifacts/.");
} finally {
  await browser.close();
  server.close();
}
