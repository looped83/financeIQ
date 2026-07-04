#!/usr/bin/env node
// Regression test suite for the analyze()/parseCSV() logic in index.html.
// No dependencies, no build step — run with: node test/run.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');

function loadApp() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const match = html.match(/<script>([\s\S]*)<\/script>/);
  if (!match) throw new Error('Could not find <script> block in index.html');

  const stubEl = {
    addEventListener() {}, style: {}, value: '',
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  };
  const sandbox = {
    document: {
      getElementById: () => stubEl,
      querySelectorAll: () => [],
      querySelector: () => null,
      createElement: () => ({}),
    },
    window: {},
    Chart: class { constructor() {} destroy() {} },
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(match[1], sandbox, { filename: 'index.html (inline script)' });
  return sandbox;
}

function readFixture(name) {
  return fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
}

// ── Assertion bookkeeping ────────────────────────────────────
let pass = 0, fail = 0;
function check(desc, fn) {
  try {
    fn();
    pass++;
    console.log(`  ✓ ${desc}`);
  } catch (e) {
    fail++;
    console.log(`  ✗ ${desc}`);
    console.log(`      ${e.message}`);
  }
}
function closeTo(actual, expected, tolerance, msg) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${msg}: expected ${expected}, got ${actual}`);
}

// ── Suite 1: dividends, corrections, buy/sell, tax optimization ──
console.log('\ndividends-and-corrections.csv');
{
  const app = loadApp();
  const rows = app.parseCSV(readFixture('dividends-and-corrections.csv'));
  const a = app.analyze(rows);

  check('parses all 9 data rows', () => assert.strictEqual(rows.length, 9));
  check('excludes rows before MIN_DATE (2024-01-01)', () => assert.strictEqual(a.enriched.length, 8));
  check('parses quoted description containing a comma', () => {
    const r = a.enriched.find(r => r.transaction_id === 'tx-002');
    assert.strictEqual(r._desc, 'Coffee, Bakery & Bread');
  });

  check('dividend net amount = amount + tax (gross minus withholding)', () => {
    const r = a.enriched.find(r => r.transaction_id === 'tx-003');
    closeTo(r._amt, 85.00, 0.001, 'tx-003 net dividend');
  });
  check('dividend correction row nets negative (amount+tax) but stays a DIVIDEND', () => {
    const r = a.enriched.find(r => r.transaction_id === 'tx-004');
    closeTo(r._amt, -15.00, 0.001, 'tx-004 net dividend correction');
    assert.strictEqual(r._isDiv, true);
  });
  check('totalDiv reflects net (85 + -15 = 70), not gross (100 + -20 = 80)', () => {
    closeTo(a.totalDiv, 70.00, 0.001, 'totalDiv');
  });

  check('BUY amount stays gross (fee tracked separately, not folded into _amt)', () => {
    const r = a.enriched.find(r => r.transaction_id === 'tx-005');
    closeTo(r._amt, -1000.00, 0.001, 'tx-005 buy amount');
  });
  check('SELL amount stays gross even though tax is present', () => {
    const r = a.enriched.find(r => r.transaction_id === 'tx-006');
    closeTo(r._amt, 550.00, 0.001, 'tx-006 sell amount');
  });
  check('totalInv / totalSold use gross trade amount', () => {
    closeTo(a.totalInv, 1000.00, 0.001, 'totalInv');
    closeTo(a.totalSold, 550.00, 0.001, 'totalSold');
  });

  check('TAX_OPTIMIZATION with amount=0 surfaces the tax value as real cash flow', () => {
    const debit = a.enriched.find(r => r.transaction_id === 'tx-007');
    const credit = a.enriched.find(r => r.transaction_id === 'tx-008');
    closeTo(debit._amt, -30.00, 0.001, 'tx-007 tax debit');
    closeTo(credit._amt, 30.00, 0.001, 'tx-008 tax credit');
  });

  check('totalInc / totalExp / netBal match hand-computed totals', () => {
    // income: 2000 (salary) + 85 (dividend) + 30 (tax refund) = 2115
    // expense: -45.50 (card) + -15 (dividend correction) + -30 (tax debit) = -90.50
    closeTo(a.totalInc, 2115.00, 0.001, 'totalInc');
    closeTo(a.totalExp, -90.50, 0.001, 'totalExp');
    closeTo(a.netBal, 2024.50, 0.001, 'netBal');
  });

  check('totalFee sums only BUY/SELL fees', () => {
    closeTo(a.totalFee, 2.00, 0.001, 'totalFee');
  });
  check('totalTax sums abs(tax) across every row type', () => {
    // 15 (div) + 5 (div correction) + 20 (sell) + 30 (tax debit) + 30 (tax credit) = 100
    closeTo(a.totalTax, 100.00, 0.001, 'totalTax');
  });

  check('expense-by-category excludes dividends even when net-negative', () => {
    assert.ok(!('Dividenden' in a.expCat), 'Dividenden should not appear in expCat');
  });
  check('expense-by-category still includes the card payment and tax debit', () => {
    closeTo(a.expCat['Kartenzahlungen'], 45.50, 0.001, 'expCat Kartenzahlungen');
    closeTo(a.expCat['Steuerkorrektur'], 30.00, 0.001, 'expCat Steuerkorrektur');
  });

  check('outlier detection does not divide by zero / crash on tiny datasets', () => {
    assert.ok(Array.isArray(a.outliers));
  });
}

// ── Suite 2: German bank export, semicolon delimiter, comma decimals ──
console.log('\ngerman-bank-semicolon.csv');
{
  const app = loadApp();
  const rows = app.parseCSV(readFixture('german-bank-semicolon.csv'));
  const a = app.analyze(rows);

  check('auto-detects ";" delimiter', () => assert.strictEqual(rows.length, 2));
  check('maps German column aliases (Buchungsdatum/Betrag) and parses comma decimals', () => {
    closeTo(a.totalInc, 1500.00, 0.001, 'totalInc');
    closeTo(a.totalExp, -25.50, 0.001, 'totalExp');
  });
  check('parses dd.mm.yyyy dates correctly', () => {
    const r = a.enriched.find(r => r.betrag === '1500,00');
    assert.strictEqual(r._month, '2024-03');
  });
}

// ── Summary ──────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
