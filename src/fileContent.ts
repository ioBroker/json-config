/**
 * Converts the content of a file, as `readFile` delivers it, into a string.
 *
 * The admin web socket sends a string or a serialized Buffer (`{ type: 'Buffer', data: [...] }`),
 * but socket.io (e.g. in the cloud) delivers binary data as `ArrayBuffer`.
 */
export function fileContentToString(file: unknown): string {
    if (typeof file === 'string') {
        return file;
    }
    if (file instanceof ArrayBuffer || ArrayBuffer.isView(file)) {
        return new TextDecoder().decode(file);
    }
    if (
        file &&
        typeof file === 'object' &&
        (file as { type?: string }).type === 'Buffer' &&
        Array.isArray((file as { data?: number[] }).data)
    ) {
        return new TextDecoder().decode(new Uint8Array((file as { data: number[] }).data));
    }
    return '';
}
