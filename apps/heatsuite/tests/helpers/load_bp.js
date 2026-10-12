/* eslint-env node */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const EventEmitter = require("events");

const root = path.resolve(__dirname, "../..");
const bpPath = path.join(root, "heatsuite.bp.js");

function createTimers() {
  let nextId = 1;
  const timers = [];
  function schedule(fn, ms, repeat) {
    const timer = { id: nextId++, fn, ms, repeat, cleared: false };
    timers.push(timer);
    return timer.id;
  }
  function clear(id) {
    const timer = timers.find(t => t.id === id);
    if (timer) timer.cleared = true;
  }
  return {
    timers,
    setTimeout(fn, ms) {
      return schedule(fn, ms, false);
    },
    setInterval(fn, ms) {
      return schedule(fn, ms, true);
    },
    clearTimeout: clear,
    clearInterval: clear,
    runByMs(ms) {
      const due = timers.filter(t => !t.cleared && t.ms === ms);
      due.forEach(t => {
        t.cleared = !t.repeat;
        t.fn();
      });
      return due.length;
    },
    runAll() {
      const due = timers.filter(t => !t.cleared);
      due.forEach(t => {
        t.cleared = !t.repeat;
        t.fn();
      });
      return due.length;
    }
  };
}

function create(options) {
  options = options || {};
  const settings = options.settings || {};
  const saved = [];
  const layouts = [];
  const logs = [];
  const gClears = [];
  const loads = [];
  const prompts = [];
  const timers = createTimers();
  const hsModule = options.hsModule || {
    getSettings() {
      return settings;
    },
    saveDataToFile(type, task, data) {
      saved.push({
        type,
        task,
        data: Object.assign({}, data)
      });
      return true;
    },
    log(msg) {
      logs.push(String(msg));
    }
  };

  function Layout(def, layoutOptions) {
    this.def = def;
    this.options = layoutOptions;
    const attachIds = node => {
      if (node.id) this[node.id] = node;
      if (node.c) node.c.forEach(attachIds);
    };
    attachIds(def);
    this.render = function () {
      layouts.push(def);
    };
  }

  function localRequire(name) {
    if (name === "Layout") return Layout;
    if (name === "HSModule") return hsModule;
    return require(name);
  }

  const context = {
    require: localRequire,
    console: {
      log() {
        logs.push(Array.prototype.slice.call(arguments).join(" "));
      }
    },
    NRF: options.NRF || { connect() { throw new Error("Unexpected NRF.connect"); } },
    Bangle: options.Bangle || {
      appRect: { x: 0, y: 0, w: 176, h: 176 },
      load() {
        loads.push(true);
      }
    },
    E: options.E || Object.assign(new EventEmitter(), {
      showPrompt(text, promptOptions) {
        prompts.push({ type: "prompt", text, options: promptOptions });
        return Promise.resolve(true);
      },
      showAlert(text, title) {
        prompts.push({ type: "alert", text, title });
        return Promise.resolve();
      },
      showMessage(text, title) {
        prompts.push({ type: "message", text, title });
      }
    }),
    g: options.g || {
      setFont(font) {
        this.fontHeight = 8 * (Number(font.split(":")[1]) || 1);
        return this;
      },
      wrapString(text) {
        return text.split("\n");
      },
      getFontHeight() {
        return this.fontHeight;
      },
      clear() {
        gClears.push(true);
      }
    },
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    setInterval: timers.setInterval,
    clearInterval: timers.clearInterval,
    Promise,
    Uint8Array,
    DataView,
    ArrayBuffer,
    Date: options.Date || Date,
    Math,
    Error,
    String,
    Number,
    Infinity,
    JSON
  };
  context.globalThis = context;

  const code = fs.readFileSync(bpPath, "utf8") +
    "\nglobalThis.__bpTestExports = {" +
    "decodeSFloat16: decodeSFloat16," +
    "parseBPMeasurement: parseBPMeasurement," +
    "getBP: getBP," +
    "startBP: startBP" +
    "};";

  vm.runInNewContext(code, context, { filename: bpPath });

  return {
    exports: context.__bpTestExports,
    context,
    settings,
    saved,
    layouts,
    logs,
    loads,
    prompts,
    gClears,
    timers
  };
}

module.exports = {
  create
};
