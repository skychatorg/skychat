/**
 * Marker error for intentional, user-facing voice errors. Its message is always a
 * known-safe static string. The run() error boundary re-throws VoiceError as-is and
 * replaces any other (raw mediasoup/library) error with a generic 'Voice error', so
 * raw exceptions never reach a client.
 */
export class VoiceError extends Error {}
