import { PluginGroup } from '../PluginGroup';
import { EncryptPlugin } from '../crypto/room/EncryptPlugin';
import { AccountPlugin } from './global/AccountPlugin';
import { AudioRecorderPlugin } from './global/AudioRecorderPlugin';
import { BackupPlugin } from './global/BackupPlugin';
import { ConnectedListPlugin } from './global/ConnectedListPlugin';
import { HelpPlugin } from './room/HelpPlugin';
import { MailPlugin } from './global/MailPlugin';
import { MessageEditPlugin } from './room/MessageEditPlugin';
import { MessageHistoryPlugin } from './room/MessageHistoryPlugin';
import { MessagePlugin } from './room/MessagePlugin';
import { MessageSeenPlugin } from './room/MessageSeenPlugin';
import { OPPlugin } from './global/OPPlugin';
import { PrivateMessagePlugin } from './global/PrivateMessagePlugin';
import { RoomManagerPlugin } from './room/RoomManagerPlugin';
import { TypingListPlugin } from './room/TypingListPlugin';
import { VoidPlugin } from './global/VoidPlugin';
import { StickerPlugin } from './global/StickerPlugin';
import { AvatarPlugin } from './global/AvatarPlugin';
import { CustomizationPlugin } from './global/CustomizationPlugin';
import { MottoPlugin } from './global/MottoPlugin';
import { PollPlugin } from './global/PollPlugin';
import { SetRightPlugin } from './global/SetRightPlugin';
import { BanPlugin } from './global/BanPlugin';
import { IpPlugin } from './global/IpPlugin';
import { KickPlugin } from './global/KickPlugin';
import { XpTickerPlugin } from './global/XpTickerPlugin';


export class CorePluginGroup extends PluginGroup {
    roomPluginClasses = [
        EncryptPlugin,
        HelpPlugin,
        MessageEditPlugin,
        MessageHistoryPlugin,
        MessagePlugin,
        MessageSeenPlugin,
        RoomManagerPlugin,
        TypingListPlugin,
    ];

    globalPluginClasses = [
        AccountPlugin,
        AudioRecorderPlugin,
        AvatarPlugin,
        BackupPlugin,
        BanPlugin,
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
