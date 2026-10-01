import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../webapp/app.js", import.meta.url), "utf8");
test("WebApp initializes and follows Telegram theme changes", () => {
  let ready = 0, expanded = 0;
  let themeChanged = () => {};
  const style = { colorScheme: "" };
  const app = {
    colorScheme: "dark", ready: () => ready++, expand: () => expanded++,
    onEvent: (name: string, handler: () => void) => { assert.equal(name, "themeChanged"); themeChanged = handler; },
  };
  runInNewContext(source, { window: { Telegram: { WebApp: app } }, document: { documentElement: { style } } });
  assert.equal(ready, 1);
  assert.equal(expanded, 1);
  assert.equal(style.colorScheme, "dark");
  app.colorScheme = "light";
  themeChanged();
  assert.equal(style.colorScheme, "light");
});
test("page script also works outside Telegram", () => {
  assert.doesNotThrow(() => runInNewContext(source, { window: {} }));
});
