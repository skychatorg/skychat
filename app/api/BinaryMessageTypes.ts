/**
 * Binary messages are prefixed with a binary header (UINT16)
 *  specifying how to decode the incoming data.
 */
export class BinaryMessageTypes {
    public static readonly AUDIO = 0x0002;
    public static readonly CURSOR = 0x0003;
}
