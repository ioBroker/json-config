import type { AdminConnection } from '@iobroker/gui-components';

/**
 * Value of a state, that was requested with the `dependsOnStates` attribute:
 * - `undefined` - the state was not read yet,
 * - `null` - the state does not exist,
 * - else the state object.
 */
export type SubscribedState = ioBroker.State | null | undefined;

interface StatePoolEntry {
    /** Components, that requested this state. The subscription is released with the last one */
    owners: Set<object>;
    /** Last known value. `null` if the state does not exist */
    value: ioBroker.State | null;
    /** True as soon as the first value (or the information, that the state does not exist) was received */
    loaded: boolean;
    /** Running subscription request. Every owner of this ID awaits it, so no element is calculated with an unknown value */
    pending?: Promise<void>;
}

/**
 * Pool of the ioBroker states, on which the configuration elements depend (see the `dependsOnStates` attribute).
 *
 * Every state is subscribed only once, independent of how many elements use it (a table with 100 rows,
 * that all depend on `adapter.0.info.connection`, produces exactly one subscription), and the value is
 * cached, so an element that is mounted later gets it without an additional request.
 */
export class StatePool {
    private readonly socket: AdminConnection;
    /** All currently subscribed state IDs */
    private readonly states = new Map<string, StatePoolEntry>();
    /** State IDs and the change handler of every owner (= configuration element) */
    private readonly owners = new Map<object, { ids: string[]; onChange: () => void }>();
    private destroyed = false;

    constructor(socket: AdminConnection) {
        this.socket = socket;
    }

    /**
     * Subscribe an owner to the given state IDs. It replaces the IDs, that were requested by this owner before,
     * because an ID can be built with a `${data.xxx}` pattern and so it can change with the data.
     *
     * The promise is resolved as soon as the values of all given states are known, so that the first
     * calculation of `hidden`/`disabled` does not run with unknown values (and a button does not flicker
     * from enabled to disabled).
     *
     * @param owner the configuration element, that requires the states
     * @param ids resolved state IDs
     * @param onChange called if one of the states changed
     */
    subscribe = async (owner: object, ids: string[], onChange: () => void): Promise<void> => {
        if (this.destroyed) {
            return;
        }
        const wanted = [...new Set(ids.filter(id => id))];
        const registered = this.owners.get(owner);

        // Nothing to subscribe if this owner is already subscribed to exactly these states
        if (registered && registered.ids.length === wanted.length && registered.ids.every(id => wanted.includes(id))) {
            registered.onChange = onChange;
        } else {
            this.owners.set(owner, { ids: wanted, onChange });

            // Release the IDs, that are not required by this owner anymore
            registered?.ids.filter(id => !wanted.includes(id)).forEach(id => this.releaseId(owner, id));

            const toSubscribe: string[] = [];
            wanted.forEach(id => {
                const entry = this.states.get(id);
                if (entry) {
                    entry.owners.add(owner);
                } else {
                    this.states.set(id, { owners: new Set([owner]), value: null, loaded: false });
                    toSubscribe.push(id);
                }
            });

            if (toSubscribe.length) {
                const request = this.requestStates(toSubscribe);
                toSubscribe.forEach(id => {
                    const entry = this.states.get(id);
                    if (entry) {
                        entry.pending = request;
                    }
                });
            }
        }

        // Wait for all running requests, also for those, that were started by another element
        const pending = wanted.map(id => this.states.get(id)?.pending).filter(p => !!p);
        if (pending.length) {
            await Promise.all(pending);
        }
    };

    /** Unsubscribe an owner from all its states */
    unsubscribe = (owner: object): void => {
        const registered = this.owners.get(owner);
        if (!registered) {
            return;
        }
        this.owners.delete(owner);
        registered.ids.forEach(id => this.releaseId(owner, id));
    };

    /**
     * Get the last known value of a state.
     *
     * @param id resolved state ID
     * @returns `undefined` if the state was not read yet, `null` if it does not exist
     */
    getValue = (id: string): SubscribedState => {
        const entry = this.states.get(id);
        if (!entry?.loaded) {
            return undefined;
        }
        return entry.value;
    };

    /** Release all subscriptions. The pool cannot be used afterwards */
    destroy(): void {
        this.destroyed = true;
        const ids = [...this.states.keys()];
        this.states.clear();
        this.owners.clear();
        if (ids.length) {
            try {
                this.socket.unsubscribeState(ids, this.onStateChanged);
            } catch (e) {
                console.error(`[JsonConfigComponent] Cannot unsubscribe from ${ids.join(', ')}: ${e as Error}`);
            }
        }
    }

    /**
     * Subscribe on the given IDs. `subscribeState` reports the current values of all existing states
     * before it resolves, so no additional `getState` request is required. States, that were not reported,
     * do not exist and stay `null`.
     */
    private async requestStates(ids: string[]): Promise<void> {
        try {
            await this.socket.subscribeState(ids, this.onStateChanged);
        } catch (e) {
            console.error(`[JsonConfigComponent] Cannot subscribe on ${ids.join(', ')}: ${e as Error}`);
        }
        ids.forEach(id => {
            const entry = this.states.get(id);
            if (entry) {
                entry.pending = undefined;
                entry.loaded = true;
            }
        });
    }

    private releaseId(owner: object, id: string): void {
        const entry = this.states.get(id);
        if (!entry) {
            return;
        }
        entry.owners.delete(owner);
        if (!entry.owners.size) {
            this.states.delete(id);
            try {
                this.socket.unsubscribeState(id, this.onStateChanged);
            } catch (e) {
                console.error(`[JsonConfigComponent] Cannot unsubscribe from ${id}: ${e as Error}`);
            }
        }
    }

    /**
     * The new value is always stored, but the owners are only informed if `val`, `ack` or `q` changed.
     * A repeated write of the same value (only `ts` changes) does not trigger a recalculation of the GUI.
     */
    private onStateChanged = (id: string, state: ioBroker.State | null | undefined): void => {
        const entry = this.states.get(id);
        if (!entry) {
            return;
        }
        const value = state ?? null;
        const changed =
            !entry.loaded ||
            entry.value?.val !== value?.val ||
            entry.value?.ack !== value?.ack ||
            entry.value?.q !== value?.q;

        entry.value = value;
        entry.loaded = true;

        if (changed) {
            entry.owners.forEach(owner => {
                try {
                    this.owners.get(owner)?.onChange();
                } catch (e) {
                    console.error(`[JsonConfigComponent] Cannot process the change of ${id}: ${e as Error}`);
                }
            });
        }
    };
}
