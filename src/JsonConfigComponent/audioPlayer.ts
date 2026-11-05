/** Converts the base64 content of a file into its bytes */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Plays a sound file, e.g. the result of `socket.readFile(adapter, fileName, true)`.
 *
 * @param base64 content of the sound file as base64
 * @param onEnded called once when the sound has ended or was stopped
 * @returns a function that stops the sound
 */
export async function playBase64Audio(base64: string, onEnded: () => void): Promise<() => void> {
    if (typeof AudioContext === 'undefined') {
        throw new Error('This browser cannot play sounds');
    }
    const context = new AudioContext();
    let buffer: AudioBuffer;
    try {
        buffer = await context.decodeAudioData(base64ToArrayBuffer(base64));
    } catch (e) {
        void context.close();
        throw e;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.onended = (): void => {
        void context.close();
        onEnded();
    };
    source.start(0);

    return (): void => source.stop();
}
