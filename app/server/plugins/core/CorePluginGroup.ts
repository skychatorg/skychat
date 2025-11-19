import { PluginGroup } from '../PluginGroup.js';
import { AccountPlugin } from './global/AccountPlugin.js';
import { AdminConfigPlugin } from './global/AdminConfigPlugin.js';
import { AudioRecorderPlugin } from './global/AudioRecorderPlugin.js';
import { AvatarPlugin } from './global/AvatarPlugin.js';
import { BackupPlugin } from './global/BackupPlugin.js';
import { BanPlugin } from './global/BanPlugin.js';
import { BlacklistPlugin } from './global/BlacklistPlugin.js';
import { ConnectedListPlugin } from './global/ConnectedListPlugin.js';
import { CustomizationPlugin } from './global/CustomizationPlugin.js';
import { DiscordPresencePlugin } from './global/DiscordPresencePlugin.js';
import { IpPlugin } from './global/IpPlugin.js';
import { JoinRoomPlugin } from './global/JoinRoomPlugin.js';
import { KickPlugin } from './global/KickPlugin.js';
import { MailPlugin } from './global/MailPlugin.js';
import { MottoPlugin } from './global/MottoPlugin.js';
import { MutePlugin } from './global/MutePlugin.js';
import { OPPlugin } from './global/OPPlugin.js';
import { PollPlugin } from './global/PollPlugin.js';
import { PrivateMessagePlugin } from './global/PrivateMessagePlugin.js';
import { ReactionPlugin } from './global/ReactionPlugin.js';
import { SetRightPlugin } from './global/SetRightPlugin.js';
import { StickerPlugin } from './global/StickerPlugin.js';
import { VoidPlugin } from './global/VoidPlugin.js';
import { WebPushPlugin } from './global/WebPushPlugin.js';
import { WelcomePlugin } from './global/WelcomePlugin.js';
import { XpTickerPlugin } from './global/XpTickerPlugin.js';
import { HelpPlugin } from './room/HelpPlugin.js';
import { MentionPlugin } from './room/MentionPlugin.js';
import { MessageEditPlugin } from './room/MessageEditPlugin.js';
import { MessageHistoryPlugin } from './room/MessageHistoryPlugin.js';
import { MessagePlugin } from './room/MessagePlugin.js';
import { MessageSeenPlugin } from './room/MessageSeenPlugin.js';
import { RoomManagerPlugin } from './room/RoomManagerPlugin.js';
import { TypingListPlugin } from './room/TypingListPlugin.js';

export class CorePluginGroup extends PluginGroup {
    roomPluginClasses = [
        HelpPlugin,
        MentionPlugin,
        MessageEditPlugin,
        MessageHistoryPlugin,
        MessagePlugin,
        MessageSeenPlugin,
        RoomManagerPlugin,
        TypingListPlugin,
    ];

    globalPluginClasses = [
        AccountPlugin,
        AdminConfigPlugin,
        AudioRecorderPlugin,
        AvatarPlugin,
        BackupPlugin,
        BanPlugin,
        BlacklistPlugin,
        ConnectedListPlugin,
        CustomizationPlugin,
        DiscordPresencePlugin,
        IpPlugin,
        JoinRoomPlugin,
        KickPlugin,
        MailPlugin,
        MottoPlugin,
        MutePlugin,
        OPPlugin,
        PollPlugin,
        PrivateMessagePlugin,
        ReactionPlugin,
        SetRightPlugin,
        StickerPlugin,
        VoidPlugin,
        WebPushPlugin,
        WelcomePlugin,
        XpTickerPlugin,
    ];
}
