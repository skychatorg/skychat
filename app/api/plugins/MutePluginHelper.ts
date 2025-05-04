import { SkyChatClient } from '../SkyChatClient';

export class MutePluginHelper {
    private readonly client: SkyChatClient;

    constructor(client: SkyChatClient) {
        this.client = client;
    }

    getMutedRooms(): number[] {
        return this.client.state.user.data.plugins.mute ?? [];
    }

    isRoomMuted(roomId: number): boolean {
        return this.getMutedRooms().includes(roomId);
    }
}
