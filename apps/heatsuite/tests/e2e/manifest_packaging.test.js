/* eslint-env node */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

module.exports = [
  {
    name: "metadata includes BP app but excludes tests",
    fn() {
      const root = path.resolve(__dirname, "../..");
      const metadata = JSON.parse(fs.readFileSync(path.join(root, "metadata.json"), "utf8"));
      const entries = metadata.storage.concat(metadata.data || []);
      const urls = entries.map(entry => entry.url || entry.name || "");
      assert.ok(urls.includes("heatsuite.bp.js"));
      assert.strictEqual(urls.some(url => /(^|\/)tests\//.test(url)), false);
    }
  },
  {
    name: "metadata packages default settings for fresh installs",
    fn() {
      const root = path.resolve(__dirname, "../..");
      const metadata = JSON.parse(fs.readFileSync(path.join(root, "metadata.json"), "utf8"));
      const entries = metadata.storage.concat(metadata.data || []);
      const byName = Object.fromEntries(entries.map(entry => [entry.name, entry]));

      assert.strictEqual(byName["heatsuite.default.json"].url, "default.json");
      assert.ok(byName["heatsuite.settings.json"]);
      assert.ok(byName["heatsuite.tasks.json"]);
      assert.ok(byName["heatsuite.survey.json"]);

      const settings = JSON.parse(fs.readFileSync(path.join(root, "default.json"), "utf8"));
      assert.ok(Array.isArray(settings.record));
      assert.ok(settings.record.includes("bat"));
      assert.strictEqual(settings.record.includes("CORESensor"), true);
    }
  },
  {
    name: "customizer defaults match packaged recorder defaults",
    fn() {
      const root = path.resolve(__dirname, "../..");
      const settings = JSON.parse(fs.readFileSync(path.join(root, "default.json"), "utf8"));
      const custom = fs.readFileSync(path.join(root, "custom.html"), "utf8");
      const recordDefaults = [];
      const recordInput = /<input[^>]+name="record"[^>]+value="([^"]+)"[^>]*>/g;
      let match;
      while ((match = recordInput.exec(custom))) {
        if (/\bchecked\b/.test(match[0])) recordDefaults.push(match[1]);
      }

      assert.deepStrictEqual(recordDefaults, settings.record);
      assert.strictEqual(recordDefaults.includes("CORESensor"), true);
    }
  }
];
