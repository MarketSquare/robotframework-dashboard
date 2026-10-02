// Playwright reporter for the robotframework-dashboard Playwright adapter.
//
// Playwright's built-in JSON reporter only writes test.step() calls. This reporter writes the same
// JSON layout, but with every step Playwright knows about: actions (page.click, locator.fill, …),
// expect() calls, hooks and fixtures, each with its real start time. playwright_to_robot.py turns
// them into keywords, so the dashboard's keyword graphs work without test.step().
//
//   // playwright.config.ts
//   reporter: [
//     ['list'],
//     ['./dashboard-reporter.js', { outputFile: 'results/dashboard-report.json', groupByFunction: true }],
//   ],
//
// Options (or environment variables, handy with --reporter on the command line):
//   outputFile       PLAYWRIGHT_DASHBOARD_OUTPUT_FILE        default: dashboard-report.json
//   groupByFunction  PLAYWRIGHT_DASHBOARD_GROUP_BY_FUNCTION  default: false
//       Put the actions a helper function or page object method makes under one step named after
//       that function (`open_shop`, `ShopPage.search`), so the dashboard shows your own building
//       blocks as keywords. Uses the TypeScript compiler when the project has it installed, else
//       a line-based scan of the source. Only the innermost named function of a call is known.
//   hooks            PLAYWRIGHT_DASHBOARD_HOOKS              default: true
//       Include the Before Hooks / After Hooks steps (fixtures, browser start, beforeEach, …).
//
// No dependencies besides Node.js and Playwright Test.

const fs = require('fs');
const path = require('path');

// Callbacks of these calls belong to the test itself, not to a helper function.
const TEST_CALL_RE = /(^|\.)(test|it|describe|step|beforeEach|beforeAll|afterEach|afterAll|serial|parallel|only|skip|fixme|fail|slow)$/;
const NOT_A_NAME = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'with', 'else', 'do', 'try']);

function flag(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return value === true || /^(1|true|yes|on)$/i.test(String(value));
}

class DashboardReporter {
  constructor(options = {}) {
    this.outputFile = options.outputFile || process.env.PLAYWRIGHT_DASHBOARD_OUTPUT_FILE || 'dashboard-report.json';
    this.groupByFunction = flag(options.groupByFunction ?? process.env.PLAYWRIGHT_DASHBOARD_GROUP_BY_FUNCTION, false);
    this.hooks = flag(options.hooks ?? process.env.PLAYWRIGHT_DASHBOARD_HOOKS, true);
    this.resolver = new FunctionResolver();
    this.errors = [];
  }

  printsToStdio() {
    return false;
  }

  onBegin(config, suite) {
    this.config = config;
    this.root = suite;
  }

  onError(error) {
    this.errors.push(serializeError(error));
  }

  async onEnd(result) {
    const report = {
      reporter: 'robotframework-dashboard',
      config: {
        version: this.config.version,
        metadata: this.config.metadata || {},
        projects: this.config.projects.map((project) => ({ name: project.name })),
      },
      stats: { startTime: result.startTime.toISOString(), duration: result.duration },
      errors: this.errors,
      suites: this.root.suites.flatMap((project) => project.suites.map((file) => this.fileSuite(file))),
    };
    // Relative to the config file, like Playwright's own JSON reporter.
    const base = this.config.configFile ? path.dirname(this.config.configFile) : process.cwd();
    const target = path.resolve(base, this.outputFile);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(report, null, 2));
  }

  // One entry per project and file. The converter merges them by file name again.
  fileSuite(file) {
    const relative = path.relative(this.config.rootDir, file.location ? file.location.file : file.title);
    return { title: relative, file: relative.split(path.sep).join('/'), ...this.suiteContent(file) };
  }

  suiteContent(suite) {
    return {
      specs: suite.tests.map((test) => this.spec(test)),
      suites: suite.suites.map((child) => ({ title: child.title, ...this.suiteContent(child) })),
    };
  }

  spec(test) {
    return {
      title: test.title,
      tags: test.tags.map((tag) => tag.replace(/^@/, '')),
      tests: [{
        projectName: test.parent.project() ? test.parent.project().name : '',
        status: test.outcome(),
        annotations: test.annotations.map(serializeAnnotation),
        results: test.results.map((result) => ({
          status: result.status,
          startTime: result.startTime.toISOString(),
          duration: result.duration,
          retry: result.retry,
          errors: result.errors.map(serializeError),
          annotations: (result.annotations || []).map(serializeAnnotation),
          steps: this.steps(result.steps),
        })),
      }],
    };
  }

  steps(steps) {
    const output = [];
    for (const step of steps) {
      if (step.category === 'attach' || step.category === 'test.attach') continue;
      if (step.category === 'hook' && !this.hooks) continue;
      const serialized = {
        title: step.title,
        category: step.category,
        startTime: step.startTime.toISOString(),
        duration: step.duration,
        steps: this.steps(step.steps),
      };
      if (step.error) serialized.error = serializeError(step.error);

      const owner = this.groupByFunction && (step.category === 'pw:api' || step.category === 'expect')
        ? this.resolver.resolve(step.location) : null;
      if (!owner) {
        output.push(serialized);
        continue;
      }
      const last = output[output.length - 1];
      if (last && last.category === 'function' && last.title === owner.name && last.owner === owner.owner) {
        last.steps.push(serialized);
      } else {
        output.push({ title: owner.name, owner: owner.owner, category: 'function', startTime: serialized.startTime,
          duration: 0, steps: [serialized] });
      }
      const group = output[output.length - 1];
      const end = Math.max(...group.steps.map((s) => Date.parse(s.startTime) + s.duration));
      group.duration = end - Date.parse(group.startTime);
      if (serialized.error && !group.error) group.error = serialized.error;
    }
    return output;
  }
}

function serializeError(error) {
  return { message: error.message || error.value || '' };
}

function serializeAnnotation(annotation) {
  return { type: annotation.type, description: annotation.description };
}

// Finds the named function a source location is in: { name, owner } or null.
class FunctionResolver {
  constructor() {
    this.cache = new Map();
    this.ts = loadTypeScript();
  }

  resolve(location) {
    if (!location || !location.file || location.file.includes('node_modules')) return null;
    let resolve = this.cache.get(location.file);
    if (resolve === undefined) {
      resolve = this.load(location.file);
      this.cache.set(location.file, resolve);
    }
    return resolve ? resolve(location.line, location.column) : null;
  }

  load(file) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      return null;
    }
    const stem = path.basename(file).replace(/(\.(spec|test))?\.[cm]?[jt]sx?$/, '');
    const fallback = lineResolver(text, stem);
    if (!this.ts) return fallback;
    try {
      const resolve = typeScriptResolver(this.ts, file, text, stem);
      // Grouping is a nicety; a parser problem must never cost the report.
      return (line, column) => {
        try {
          return resolve(line, column);
        } catch {
          return fallback(line, column);
        }
      };
    } catch {
      return fallback;
    }
  }
}

function loadTypeScript() {
  try {
    const module = require(require.resolve('typescript', { paths: [process.cwd()] }));
    // Playwright's loader can hand over the CommonJS module wrapped as { default: … }.
    const ts = module && module.createSourceFile ? module : module && module.default;
    return ts && ts.createSourceFile ? ts : null;
  } catch {
    return null;
  }
}

function typeScriptResolver(ts, file, text, stem) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const lineCount = source.getLineStarts().length;

  function nameOf(node) {
    if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isGetAccessor(node)) && node.name) {
      return node.name.getText(source);
    }
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      if (node.name) return node.name.getText(source);
      const parent = node.parent;
      if ((ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent))
          && parent.name) {
        return parent.name.getText(source);
      }
    }
    return null;
  }

  return (line, column) => {
    if (line < 1 || line > lineCount) return null;
    const position = source.getPositionOfLineAndCharacter(line - 1, Math.max(0, (column || 1) - 1));
    let node = deepest(source, position);
    for (; node; node = node.parent) {
      if (!ts.isFunctionLike(node)) continue;
      const name = nameOf(node);
      if (name) {
        let owner = stem;
        for (let parent = node.parent; parent; parent = parent.parent) {
          if ((ts.isClassDeclaration(parent) || ts.isClassExpression(parent)) && parent.name) {
            owner = parent.name.getText(source);
            break;
          }
        }
        return { name, owner };
      }
      // An anonymous callback: inside test(...) or test.step(...) the call belongs to the test;
      // anywhere else (forEach, map, …) keep looking for a named function around it.
      const call = node.parent;
      if (call && ts.isCallExpression(call) && TEST_CALL_RE.test(call.expression.getText(source).replace(/\s/g, ''))) {
        return null;
      }
    }
    return null;
  };

  function deepest(node, position) {
    for (const child of node.getChildren(source)) {
      if (child.getStart(source) <= position && position < child.getEnd()) return deepest(child, position);
    }
    return node;
  }
}

// Fallback without TypeScript: walk up from the call to the unmatched `{` lines around it.
function lineResolver(text, stem) {
  const strip = (line) => line
    .replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, '""')
    .replace(/\/\/.*$/, '');
  const raw = text.split(/\r?\n/);
  const lines = raw.map(strip);
  const patterns = [
    /\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/,
    /\b([A-Za-z_$][\w$]*)\s*[:=]\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*(?::[^=]+)?=>|[A-Za-z_$][\w$]*\s*=>)/,
    /^\s*(?:(?:public|private|protected|static|async|override|readonly)\s+)*\*?\s*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::[^{]+)?\{/,
  ];

  return (line, column) => {
    if (line < 1 || line > raw.length) return null;
    let depth = 0;
    let found = null;
    for (let index = line - 1; index >= 0; index--) {
      // On the line of the call only the text before it counts: `async open() { await page.click() }`.
      const opener = index === line - 1 ? strip(raw[index].slice(0, Math.max(0, (column || 1) - 1))) : lines[index];
      for (let i = opener.length - 1; i >= 0; i--) {
        if (opener[i] === '}') depth++;
        else if (opener[i] === '{') depth--;
      }
      if (depth >= 0) continue;
      depth = 0; // this line opens a block around the call
      if (found) {
        const cls = /\bclass\s+([A-Za-z_$][\w$]*)/.exec(opener);
        if (cls) return { name: found, owner: cls[1] };
        continue;
      }
      const callee = /([\w$.]+)\s*\(/.exec(opener);
      if (callee && TEST_CALL_RE.test(callee[1]) && /=>|function/.test(opener)) return null;
      for (const pattern of patterns) {
        const match = pattern.exec(opener);
        if (match && !NOT_A_NAME.has(match[1])) {
          found = match[1];
          break;
        }
      }
    }
    return found ? { name: found, owner: stem } : null;
  };
}

module.exports = DashboardReporter;
module.exports.FunctionResolver = FunctionResolver;
module.exports.lineResolver = lineResolver;
module.exports.typeScriptResolver = typeScriptResolver;
