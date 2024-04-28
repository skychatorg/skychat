import { PluginGroup } from '../PluginGroup.js';
import { AccountPlugin } from './global/AccountPlugin.js';
import { AudioRecorderPlugin } from './global/AudioRecorderPlugin.js';
import { BackupPlugin } from './global/BackupPlugin.js';
import { ConnectedListPlugin } from './global/ConnectedListPlugin.js';
import { HelpPlugin } from './room/HelpPlugin.js';
import { MailPlugin } from './global/MailPlugin.js';
import { MessageEditPlugin } from './room/MessageEditPlugin.js';
import { MessageHistoryPlugin } from './room/MessageHistoryPlugin.js';
import { MessagePlugin } from './room/MessagePlugin.js';
import { MessageSeenPlugin } from './room/MessageSeenPlugin.js';
import { OPPlugin } from './global/OPPlugin.js';
import { PrivateMessagePlugin } from './global/PrivateMessagePlugin.js';
import { RoomManagerPlugin } from './room/RoomManagerPlugin.js';
import { TypingListPlugin } from './room/TypingListPlugin.js';
import { VoidPlugin } from './global/VoidPlugin.js';
import { StickerPlugin } from './global/StickerPlugin.js';
import { AvatarPlugin } from './global/AvatarPlugin.js';
import { CustomizationPlugin } from './global/CustomizationPlugin.js';
import { MottoPlugin } from './global/MottoPlugin.js';
import { PollPlugin } from './global/PollPlugin.js';
import { SetRightPlugin } from './global/SetRightPlugin.js';
import { BanPlugin } from './global/BanPlugin.js';
import { IpPlugin } from './global/IpPlugin.js';
import { KickPlugin } from './global/KickPlugin.js';
import { XpTickerPlugin } from './global/XpTickerPlugin.js';
import { BlacklistPlugin } from './global/BlacklistPlugin.js';
import { MentionPlugin } from './room/MentionPlugin.js';
import { AdminConfigPlugin } from './global/AdminConfigPlugin.js';

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
        IpPlugin,
        KickPlugin,
        MailPlugin,
        MottoPlugin,
        OPPlugin,
        PollPlugin,
        PrivateMessagePlugin,
        SetRightPlugin,
        StickerPlugin,
        VoidPlugin,
        XpTickerPlugin,
    ];
}
