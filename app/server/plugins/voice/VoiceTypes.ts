import type { DtlsParameters, IceCandidate, IceParameters, MediaKind, RtpCapabilities, RtpParameters } from 'mediasoup/node/lib/types.js';

/**
 * What the client sees in the channel list (everyone, even those not in the channel).
 * `users` is the per-viewer roster: usernames the viewer is allowed to see in this
 * channel (shadowbanned-by-others and blacklist pairs are filtered out per-viewer).
 * NEVER carries a per-user IP.
 */
export type SanitizedVoiceChannel = {
    id: number;
    name: string;
    users: string[];
};

/** Direction of a mediasoup transport from the client's point of view. */
export type VoiceTransportDirection = 'send' | 'recv';

/**
 * Server -> client transport parameters.
 * iceCandidates contains ONLY the SFU's own candidates (announcedAddress). Never a client's.
 * Carries NO client IP, NO SDP.
 */
export type VoiceTransportParams = {
    direction: VoiceTransportDirection;
    id: string;
    iceParameters: IceParameters;
    iceCandidates: IceCandidate[];
    dtlsParameters: DtlsParameters;
    /** HMAC defense-in-depth token binding this transport to {connection, channel, exp}. */
    dtlsId: string;
};

/** A remote producer the client may consume. Identifies the speaker, never their IP. */
export type VoiceProducerInfo = {
    producerId: string;
    userId: number;
    username: string;
};

/** Server -> client consume response. */
export type VoiceConsumeParams = {
    consumerId: string;
    producerId: string;
    kind: MediaKind;
    rtpParameters: RtpParameters;
    userId: number;
    username: string;
};

/** Client -> server inbound shapes (after JSON.parse of the command arg). */
export type ClientRtpCapabilities = { rtpCapabilities: RtpCapabilities };
export type ClientDtlsParameters = { dtlsParameters: DtlsParameters };
export type ClientProduceParameters = { kind: MediaKind; rtpParameters: RtpParameters };
