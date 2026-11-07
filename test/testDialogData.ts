import assert from 'node:assert/strict';

import { writeDialogData } from '../src/dialogData';

/** Stands in for ConfigGeneric.setValue for top level attributes */
function setValue(native: Record<string, any>, attr: string, value: any): void {
    if (value === null) {
        delete native[attr];
    } else {
        native[attr] = value;
    }
}

/** What the component does when the configuration is saved: everything is saved except attributes starting with `_` */
function onSave(
    native: Record<string, any>,
    data: Record<string, any>,
    originalData: Record<string, any> | undefined,
): Record<string, any> {
    return writeDialogData(native, data, originalData, attr => !attr.startsWith('_'), setValue);
}

/** A value the adapter wrote while the dialog was open survives saving a change of another attribute */
function testValueWrittenByTheAdapterWhileOpen(): void {
    const originalData = { port: 80, devices: [] };
    const data = { port: 81, devices: [] };
    // read when saving: the adapter added a device in the meantime
    const native: Record<string, any> = { port: 80, devices: [{ id: 'lamp1' }] };

    onSave(native, data, originalData);

    assert.deepStrictEqual(native, { port: 81, devices: [{ id: 'lamp1' }] });
}

/** An attribute changed in the dialog is written, even when the adapter changed it too */
function testChangedInTheDialog(): void {
    const originalData = { devices: [] };
    const data = { devices: [{ id: 'mine' }] };
    const native: Record<string, any> = { devices: [{ id: 'lamp1' }] };

    onSave(native, data, originalData);

    assert.deepStrictEqual(native, { devices: [{ id: 'mine' }] });
}

/** Values are compared by content, a copy of an unchanged table is no change */
function testCopyOfAnUnchangedValue(): void {
    const originalData = { hosts: [{ host: 'a' }], options: { retries: 3 } };
    const data = JSON.parse(JSON.stringify(originalData));
    const native: Record<string, any> = { hosts: [{ host: 'a' }, { host: 'b' }], options: { retries: 5 } };

    onSave(native, data, originalData);

    assert.deepStrictEqual(native, { hosts: [{ host: 'a' }, { host: 'b' }], options: { retries: 5 } });
}

/** An attribute that is not saved is removed from the native and handed back with its value in the dialog */
function testAttributeThatIsNotSaved(): void {
    const native: Record<string, any> = { port: 80, _session: 'old' };

    const notSaved = onSave(native, { port: 80, _session: 'new' }, { port: 80, _session: 'old' });

    assert.deepStrictEqual(native, { port: 80 });
    assert.deepStrictEqual(notSaved, { _session: 'new' });
}

/** Without the values of the opening every attribute of the dialog is written */
function testWithoutTheValuesOfTheOpening(): void {
    const native: Record<string, any> = { port: 80, devices: [{ id: 'lamp1' }] };

    onSave(native, { port: 80, devices: [] }, undefined);

    assert.deepStrictEqual(native, { port: 80, devices: [] });
}

const tests = [
    testValueWrittenByTheAdapterWhileOpen,
    testChangedInTheDialog,
    testCopyOfAnUnchangedValue,
    testAttributeThatIsNotSaved,
    testWithoutTheValuesOfTheOpening,
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
