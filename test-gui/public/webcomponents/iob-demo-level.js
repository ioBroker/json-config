/**
 * A demo web component for the test GUI: a bar that sets a number, the value of a state and two dialogs.
 *
 * Written without the base class of `@iobroker/web-components`, so the module runs as it is, without a build.
 * In JSON-Config it gets the value of its attribute as `value` and changes it with the event `iob-change`.
 */
const TAG = 'iob-demo-level';

const STYLE = `
:host { display: block; width: 100%; height: 100%; container-type: size; }
.root { box-sizing: border-box; height: 100%; padding: 8px; display: flex; flex-direction: column; gap: 8px;
    border: 1px solid var(--divider); border-radius: calc(var(--radius) * 2); background: var(--paper); }
.track { position: relative; flex: 1; min-height: 16px; border-radius: var(--radius); background: var(--divider);
    cursor: pointer; touch-action: none; }
.bar { position: absolute; inset: 0 auto 0 0; border-radius: var(--radius); background: var(--primary); }
.text { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font-size: min(40cqh, 24px); font-weight: bold; }
.row { display: flex; gap: 8px; align-items: center; font-size: 13px; color: var(--text-secondary); }
.row span { flex: 1; }
button { border: 0; border-radius: var(--radius); padding: 4px 10px; font: inherit; cursor: pointer;
    background: var(--primary); color: var(--primary-contrast); }
`;

const INFO_STYLE = `
:host { display: block; }
button { border: 0; border-radius: 4px; padding: 4px 10px; font: inherit; cursor: pointer;
    background: var(--primary); color: var(--primary-contrast); }
`;

class DemoLevel extends HTMLElement {
    #socket = null;
    #settings = {};
    #theme = null;
    #dialogs = null;
    #value = 0;
    /** Set by the "Limits" dialog, else `max` of the settings */
    #max = null;
    #state = null;
    #lastResult = '';
    #subscription = null;
    #dragging = false;

    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        shadow.innerHTML = `<style>${STYLE}</style>
            <div class="root">
                <div class="track"><div class="bar"></div><div class="text"></div></div>
                <div class="row"><span class="state"></span><button class="limits"></button><button class="info">Info</button></div>
            </div>`;
        const track = shadow.querySelector('.track');
        track.addEventListener('pointerdown', e => {
            this.#dragging = true;
            track.setPointerCapture(e.pointerId);
            this.#fromPointer(e, track);
        });
        track.addEventListener('pointermove', e => this.#dragging && this.#fromPointer(e, track));
        track.addEventListener('pointerup', () => {
            if (this.#dragging) {
                this.#dragging = false;
                // the configuration gets the value once, when the user lets go
                if (!this.#emit('iob-change', this.#value)) {
                    this.#lastResult = 'taken by the host';
                } else {
                    this.#lastResult = 'no host took it';
                }
                this.#render();
            }
        });
        shadow.querySelector('.limits').addEventListener('click', () => this.#openLimits());
        shadow.querySelector('.info').addEventListener('click', () => this.#openInfo());
    }

    get socket() {
        return this.#socket;
    }
    set socket(socket) {
        this.#socket = socket || null;
        this.#subscribe();
    }

    get settings() {
        return this.#settings;
    }
    set settings(settings) {
        this.#settings = settings || {};
        this.#subscribe();
        this.#render();
    }

    get theme() {
        return this.#theme;
    }
    set theme(theme) {
        this.#theme = theme && typeof theme === 'object' ? theme : null;
        this.#render();
    }

    get dialogs() {
        return this.#dialogs;
    }
    set dialogs(dialogs) {
        this.#dialogs = dialogs || null;
    }

    /** JSON-Config: the value of the attribute of the item */
    get value() {
        return this.#value;
    }
    set value(value) {
        this.#value = typeof value === 'number' ? value : 0;
        this.#render();
    }

    connectedCallback() {
        this.#subscribe();
        this.#render();
    }

    disconnectedCallback() {
        this.#unsubscribe();
    }

    get #maximum() {
        return this.#max ?? this.#settings.max ?? 100;
    }

    #fromPointer(e, track) {
        const rect = track.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
        this.#value = Math.round(ratio * this.#maximum);
        this.#render();
    }

    #emit(type, detail) {
        return this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true, cancelable: true }));
    }

    #onState = (_id, state) => {
        this.#state = state || null;
        this.#render();
    };

    #subscribe() {
        const id = this.isConnected && this.#socket ? this.#settings.oid : null;
        if (this.#subscription?.id === id && this.#subscription?.socket === this.#socket) {
            return;
        }
        this.#unsubscribe();
        if (id) {
            this.#subscription = { id, socket: this.#socket };
            this.#socket.subscribeState(id, this.#onState).catch(e => console.warn(`<${TAG}>: ${e}`));
        }
    }

    #unsubscribe() {
        if (this.#subscription) {
            this.#subscription.socket.unsubscribeState(this.#subscription.id, this.#onState);
            this.#subscription = null;
            this.#state = null;
        }
    }

    async #openLimits() {
        if (!this.#dialogs) {
            return;
        }
        const result = await this.#dialogs.open({
            title: { en: 'Limits', de: 'Grenzen' },
            form: {
                type: 'panel',
                items: {
                    max: { type: 'number', label: 'Maximum', min: 1, max: 1000 },
                    round: { type: 'checkbox', label: { en: 'Round to 10', de: 'Auf 10 runden' }, default: false },
                },
            },
            data: { max: this.#maximum },
        });
        this.#lastResult = `limits: ${JSON.stringify(result)}`;
        if (result) {
            this.#max = result.max;
        }
        this.#render();
    }

    async #openInfo() {
        if (!this.#dialogs) {
            return;
        }
        const content = document.createElement('div');
        // the host moves the content into its dialog, out of the element: it takes the colors along
        for (const name of ['--primary', '--primary-contrast']) {
            content.style.setProperty(name, this.style.getPropertyValue(name));
        }
        const shadow = content.attachShadow({ mode: 'open' });
        // not the style of the element: without a height of its own, the content takes the height of its text
        shadow.innerHTML = `<style>${INFO_STYLE}</style><p>The value is ${this.#value} of ${this.#maximum}.</p><button>Done</button>`;
        shadow
            .querySelector('button')
            .addEventListener('click', () =>
                content.dispatchEvent(
                    new CustomEvent('iob-dialog-close', { detail: 'done', bubbles: true, composed: true }),
                ),
            );
        const result = await this.#dialogs.open({ title: 'Info', element: content, width: 360 });
        this.#lastResult = `info: ${JSON.stringify(result)}`;
        this.#render();
    }

    #render() {
        const theme = this.#theme || {};
        const vars = {
            '--primary': theme.primary || '#3399CC',
            '--primary-contrast': theme.primaryContrast || '#FFFFFF',
            '--paper': theme.paper || 'transparent',
            '--divider': theme.divider || 'rgba(0, 0, 0, 0.12)',
            '--text-secondary': theme.textSecondary || 'rgba(0, 0, 0, 0.6)',
            '--radius': `${theme.borderRadius ?? 4}px`,
        };
        for (const [name, value] of Object.entries(vars)) {
            this.style.setProperty(name, value);
        }
        const shadow = this.shadowRoot;
        const unit = this.#settings.unit ?? '';
        shadow.querySelector('.bar').style.width = `${Math.min(100, (this.#value / this.#maximum) * 100)}%`;
        shadow.querySelector('.text').textContent = `${this.#value} / ${this.#maximum} ${unit}`;
        const oid = this.#settings.oid;
        shadow.querySelector('.state').textContent =
            (oid ? `${oid}: ${this.#state ? String(this.#state.val) : '-'}` : 'no state') +
            (this.#lastResult ? ` · ${this.#lastResult}` : '');
        shadow.querySelector('.limits').textContent = this.#socket?.systemLang === 'de' ? 'Grenzen' : 'Limits';
    }
}

if (!customElements.get(TAG)) {
    customElements.define(TAG, DemoLevel);
}
