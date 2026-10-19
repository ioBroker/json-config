import assert from 'node:assert/strict';

import { isLicenseVersionValid } from '../src/licenseVersion';

/** A vis-1 license (`<2`) is no license for vis-2, unless it was converted and has a UUID */
function testVis1LicenseOnVis2(): void {
    assert.strictEqual(isLicenseVersionValid('2.20.2', '<2', 'free', 'vis-2'), false);
    assert.strictEqual(isLicenseVersionValid('2.20.2', '&lt;2', 'free', 'vis-2'), false);
    // converted: the exception of the vis-2 adapter, for its version 2 only
    assert.strictEqual(isLicenseVersionValid('2.20.2', '<2', 'free', 'vis-2', true), true);
    assert.strictEqual(isLicenseVersionValid('3.0.0', '<2', 'free', 'vis-2', true), false);
    // the exception is for vis-2 alone
    assert.strictEqual(isLicenseVersionValid('2.0.0', '<2', 'free', 'other', true), false);
}

function testRules(): void {
    assert.strictEqual(isLicenseVersionValid('1.5.0', '<2', 'free', 'vis'), true);
    assert.strictEqual(isLicenseVersionValid('1.5.0', '<=1', 'free', 'x'), true);
    assert.strictEqual(isLicenseVersionValid('3.0.0', '>=3', 'free', 'x'), true);
    assert.strictEqual(isLicenseVersionValid('2.0.0', '>=3', 'free', 'x'), false);
    assert.strictEqual(isLicenseVersionValid('3.0.0', '>2', 'free', 'x'), true);
    assert.strictEqual(isLicenseVersionValid('2.1.0', '=2', 'free', 'x'), true);
    assert.strictEqual(isLicenseVersionValid('2.1.0', '==2', 'free', 'x'), true);
    assert.strictEqual(isLicenseVersionValid('2.1.0', '===2', 'free', 'x'), true);
    assert.strictEqual(isLicenseVersionValid('3.1.0', '===2', 'free', 'x'), false);
    // a license for one major version
    assert.strictEqual(isLicenseVersionValid('2.1.0', '2', 'free', 'x'), true);
    assert.strictEqual(isLicenseVersionValid('3.1.0', '2', 'free', 'x'), false);
}

/** A commercial license is valid for all versions */
function testCommercial(): void {
    assert.strictEqual(isLicenseVersionValid('3.1.0', '2', 'R-1234', 'x'), true);
    assert.strictEqual(isLicenseVersionValid('2.1.0', '<2', 'MANUALLY_CREATED', 'x'), true);
}

/** Without a rule or without an installed version there is nothing to compare */
function testNothingToCompare(): void {
    assert.strictEqual(isLicenseVersionValid('2.1.0', undefined, 'free', 'x'), true);
    assert.strictEqual(isLicenseVersionValid('2.1.0', '', 'free', 'x'), true);
    assert.strictEqual(isLicenseVersionValid(undefined, '<2', 'free', 'x'), true);
}

const tests = [testVis1LicenseOnVis2, testRules, testCommercial, testNothingToCompare];

for (const test of tests) {
    try {
        test();
        console.log(`  ok  ${test.name}`);
    } catch (e) {
        console.error(`  FAIL  ${test.name}`);
        console.error(e);
        process.exit(1);
    }
}

console.log('Tests successful!');
