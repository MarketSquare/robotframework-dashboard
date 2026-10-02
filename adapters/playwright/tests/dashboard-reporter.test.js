// Unit tests for dashboard-reporter.js; no dependencies, run with:
//   node --test adapters/playwright/tests/dashboard-reporter.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DashboardReporter = require('../dashboard-reporter.js');
const { lineResolver, FunctionResolver } = DashboardReporter;

const SOURCE = `import { Page } from '@playwright/test';
export async function open_shop(page: Page) {
  await page.goto('/');
}
export const login = async (page: Page, user: string) => {
  await page.fill('#user', user);
  ['a', 'b'].forEach(async (x) => { await page.fill('#x', x); });
  const helper = { submit: async () => { await page.click('#go'); } };
  if (user) {
    await page.click('#ok');
  }
};
export class Admin {
  constructor(private page: Page) {}
  async openMenu() { await this.page.click('#menu'); }
  async logout() {
    await this.page.click('#logout');
  }
}
test.describe('Admin', () => {
  test('menu', async ({ page }) => {
    await page.click('#menu');
    await test.step('Check', async () => {
      await page.click('#check');
    });
  });
});
`;

// [line, expected] with the column of the first `page.` call on that line
const CASES = [
  [3, { name: 'open_shop', owner: 'helpers' }],
  [6, { name: 'login', owner: 'helpers' }],
  [7, { name: 'login', owner: 'helpers' }], // anonymous forEach callback: keep looking up
  [8, { name: 'submit', owner: 'helpers' }],
  [10, { name: 'login', owner: 'helpers' }], // inside an if block
  [15, { name: 'openMenu', owner: 'Admin' }], // opener and call on one line
  [17, { name: 'logout', owner: 'Admin' }],
  [22, null], // directly in a test: no group
  [24, null], // inside test.step: no group
];

function column(line) {
  return SOURCE.split('\n')[line - 1].search(/page\./) + 1;
}

test('line resolver finds the enclosing named function', () => {
  const resolve = lineResolver(SOURCE, 'helpers');
  for (const [line, expected] of CASES) {
    assert.deepStrictEqual(resolve(line, column(line)), expected, `line ${line}`);
  }
});

test('FunctionResolver gives the same answers (TypeScript when installed, else line scan)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-reporter-'));
  const file = path.join(dir, 'helpers.ts');
  fs.writeFileSync(file, SOURCE);
  const resolver = new FunctionResolver();
  for (const [line, expected] of CASES) {
    assert.deepStrictEqual(resolver.resolve({ file, line, column: column(line) }), expected, `line ${line}`);
  }
  assert.strictEqual(resolver.resolve({ file: path.join(dir, 'missing.ts'), line: 1, column: 1 }), null);
  assert.strictEqual(resolver.resolve({ file: '/x/node_modules/lib.js', line: 1, column: 1 }), null);
});

function step(title, category, start, duration, extra = {}) {
  return { title, category, startTime: new Date(Date.UTC(2026, 0, 2, 10, 0, 0, start)), duration, steps: [], ...extra };
}

test('steps: attachments dropped, hooks optional, actions grouped by function', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-reporter-'));
  const file = path.join(dir, 'helpers.ts');
  fs.writeFileSync(file, SOURCE);
  const at = (line) => ({ file, line, column: column(line) });
  const steps = [
    step('Before Hooks', 'hook', 0, 10),
    step('Navigate to "/"', 'pw:api', 10, 5, { location: at(3) }),
    step('Fill "joe"', 'pw:api', 15, 5, { location: at(6) }),
    step('Click', 'pw:api', 20, 5, { location: at(10), error: { message: 'boom' } }),
    step('screenshot', 'attach', 25, 0),
    step('Click', 'pw:api', 30, 5, { location: at(22) }),
  ];

  const plain = new DashboardReporter({ outputFile: 'x.json' });
  assert.deepStrictEqual(plain.steps(steps).map((s) => s.title),
    ['Before Hooks', 'Navigate to "/"', 'Fill "joe"', 'Click', 'Click']);

  const grouped = new DashboardReporter({ outputFile: 'x.json', groupByFunction: true, hooks: false });
  const result = grouped.steps(steps);
  assert.deepStrictEqual(result.map((s) => [s.title, s.category, s.owner]), [
    ['open_shop', 'function', 'helpers'],
    ['login', 'function', 'helpers'],
    ['Click', 'pw:api', undefined],
  ]);
  const login = result[1];
  assert.deepStrictEqual(login.steps.map((s) => s.title), ['Fill "joe"', 'Click']);
  assert.strictEqual(login.duration, 10); // from the first action's start to the last one's end
  assert.deepStrictEqual(login.error, { message: 'boom' });
});

test('environment variables configure the reporter', () => {
  process.env.PLAYWRIGHT_DASHBOARD_GROUP_BY_FUNCTION = 'true';
  process.env.PLAYWRIGHT_DASHBOARD_HOOKS = '0';
  try {
    const reporter = new DashboardReporter();
    assert.strictEqual(reporter.groupByFunction, true);
    assert.strictEqual(reporter.hooks, false);
    assert.strictEqual(reporter.outputFile, 'dashboard-report.json');
  } finally {
    delete process.env.PLAYWRIGHT_DASHBOARD_GROUP_BY_FUNCTION;
    delete process.env.PLAYWRIGHT_DASHBOARD_HOOKS;
  }
});
