import assert from 'node:assert/strict';

import { AES_192_CBC_PREFIX, replaceEncryptedNative } from '../src/encryptedNative';

/** Stands in for the AES encryption, which needs CryptoJS and a browser */
function fakeEncrypt(value: string): string {
    return `${AES_192_CBC_PREFIX}${value}`;
}

/** Stands in for the AES decryption */
function fakeDecrypt(value: string): string {
    return value.startsWith(AES_192_CBC_PREFIX) ? value.substring(AES_192_CBC_PREFIX.length) : `xor(${value})`;
}

/** What the component does when the configuration is saved */
function onSave(native: Record<string, any>, encryptedNative: string[]): void {
    replaceEncryptedNative(native, encryptedNative, value => fakeEncrypt(value));
}

/** What the component does when the configuration is loaded */
function onLoad(native: Record<string, any>, encryptedNative: string[]): void {
    replaceEncryptedNative(native, encryptedNative, (value, isNested) =>
        !isNested || value.startsWith(AES_192_CBC_PREFIX) ? fakeDecrypt(value) : value,
    );
}

/** A path that reaches into a table has to be applied to every row */
function testTablePath(): void {
    const native: Record<string, any> = {
        hosts: [
            { host: 'a', password: 'one' },
            { host: 'b', password: 'two' },
            { host: 'c', password: '' },
            { host: 'd' },
            null,
        ],
    };

    onSave(native, ['hosts.password']);

    assert.strictEqual(native.hosts[0].password, `${AES_192_CBC_PREFIX}one`);
    assert.strictEqual(native.hosts[1].password, `${AES_192_CBC_PREFIX}two`);
    // an empty, a missing and a broken row stay as they are
    assert.strictEqual(native.hosts[2].password, '');
    assert.strictEqual(native.hosts[3].password, undefined);
    assert.strictEqual(native.hosts[4], null);
    // the other columns are untouched
    assert.strictEqual(native.hosts[0].host, 'a');
}

/** A top level attribute keeps working as it did before the paths were resolved */
function testTopLevelAndNestedObject(): void {
    const native: Record<string, any> = {
        password: 'top',
        complex: { password: 'nested' },
        other: 'untouched',
    };

    onSave(native, ['password', 'complex.password']);

    assert.strictEqual(native.password, `${AES_192_CBC_PREFIX}top`);
    assert.strictEqual(native.complex.password, `${AES_192_CBC_PREFIX}nested`);
    assert.strictEqual(native.other, 'untouched');
}

/** A path that leads nowhere must not create anything or throw */
function testPathsThatLeadNowhere(): void {
    const native: Record<string, any> = {
        oauth_token: [],
        hosts: 'not a table',
        complex: null,
        num: 42,
    };
    const before = JSON.stringify(native);

    onSave(native, ['oauth_token.secureid', 'hosts.password', 'complex.password', 'num.password', 'missing.deep.x']);

    assert.strictEqual(JSON.stringify(native), before);
}

/** The whole point: what a table holds today survives the first load and is encrypted on the first save */
function testPlainTextOfAnAffectedInstallation(): void {
    // this is what iobroker.imap stores today: encryptedNative ["hosts.password"], the value plain
    const native: Record<string, any> = { hosts: [{ host: 'a', password: 'myPlainPw' }] };
    const encryptedNative = ['hosts.password'];

    // loading must not run plain text through the decryption, that would turn it into garbage
    onLoad(native, encryptedNative);
    assert.strictEqual(native.hosts[0].password, 'myPlainPw');

    onSave(native, encryptedNative);
    assert.strictEqual(native.hosts[0].password, `${AES_192_CBC_PREFIX}myPlainPw`);

    // and from here on it is a normal round trip
    onLoad(native, encryptedNative);
    assert.strictEqual(native.hosts[0].password, 'myPlainPw');
}

/** A top level attribute may still be stored in the legacy format, which has to stay readable */
function testLegacyTopLevel(): void {
    const native: Record<string, any> = { password: 'legacyCipher' };

    onLoad(native, ['password']);

    // no marker, but a top level attribute is decrypted anyway - the fallback handles the old format
    assert.strictEqual(native.password, 'xor(legacyCipher)');
}

/** Nothing listed, nothing to walk */
function testNothingToDo(): void {
    const native: Record<string, any> = { password: 'top' };

    replaceEncryptedNative(native, undefined, () => 'changed');
    replaceEncryptedNative(native, [], () => 'changed');
    replaceEncryptedNative(undefined, ['password'], () => 'changed');

    assert.strictEqual(native.password, 'top');
}

const tests = [
    testTablePath,
    testTopLevelAndNestedObject,
    testPathsThatLeadNowhere,
    testPlainTextOfAnAffectedInstallation,
    testLegacyTopLevel,
    testNothingToDo,
];

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
