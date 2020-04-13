import {Command} from "./Command";
import {Plugin} from "./Plugin";
import {MessageCommand} from "./impl/core/MessageCommand";
import {SandalePlugin} from "./impl/entertainment/SandalePlugin";
import {AvatarPlugin} from "./impl/customization/AvatarPlugin";
import {CursorPlugin} from "./impl/customization/CursorPlugin";
import {MutePlugin} from "./impl/moderation/MutePlugin";
import {TypingListPlugin} from "./impl/core/TypingListPlugin";
import {MotoPlugin} from "./impl/customization/MotoPlugin";
import {YoutubePlugin} from "./impl/youtube/YoutubePlugin";
import {Room} from "../Room";
import {HelpCommand} from "./impl/core/HelpCommand";
import {ConnectedListPlugin} from "./impl/core/ConnectedListPlugin";
import {PrivateMessagePlugin} from "./impl/core/PrivateMessagePlugin";
import {SetRightCommand} from "./impl/moderation/SetRightCommand";
import {ColorPlugin} from "./impl/customization/ColorPlugin";
import {ShopPlugin} from "./impl/customization/ShopPlugin";
import {MoneyFarmerPlugin} from "./impl/core/MoneyFarmerPlugin";
import {OfferMoney} from "./impl/moderation/OfferMoney";
import {HistoryClearPlugin} from "./impl/moderation/HistoryClearPlugin";
import {MessageEditCommand} from "./impl/core/MessageEditCommand";
import {StickerPlugin} from "./impl/moderation/StickerPlugin";
import {IpPlugin} from "./impl/moderation/IpPlugin";
import {RisiBankPlugin} from "./impl/entertainment/RisiBankPlugin";
import {GuessTheNumberPlugin} from "./impl/entertainment/GuessTheNumberPlugin";
import {RoulettePlugin} from "./impl/entertainment/RoulettePlugin";


/**
 * Utility class that handles the list of commands and plugins
 */
export class CommandManager {

    /**
     * Available commands and plugins
     */
    public static readonly COMMANDS: Array<new (room: Room) => Command> = [
        AvatarPlugin,
        ColorPlugin,
        ConnectedListPlugin,
        CursorPlugin,
        HelpCommand,
        HistoryClearPlugin,
        IpPlugin,
        MessageCommand,
        MessageEditCommand,
        MotoPlugin,
        MutePlugin,
        OfferMoney,
        MoneyFarmerPlugin,
        PrivateMessagePlugin,
        GuessTheNumberPlugin,
        RisiBankPlugin,
        RoulettePlugin,
        SandalePlugin,
        SetRightCommand,
        ShopPlugin,
        StickerPlugin,
        TypingListPlugin,
        YoutubePlugin
    ];


    /**
     * Load all commands and plugins
     */
    public static instantiateCommands(room: Room) {
        // Initialize command and plugin instances
        const commands: {[commandName: string]: Command} = {};
        // For every command/plugin
        for (let CommandConstructor of CommandManager.COMMANDS) {
            // Instantiate it
            const command = new CommandConstructor(room);
            // Add it in the command object with its name and all its aliases
            commands[command.name] = command;
            command.aliases.forEach((alias: any) => {
                commands[alias] = command;
            });
        }
        return commands;
    }

    /**
     * Load all commands and plugins
     */
    public static extractPlugins(commands: {[commandName: string]: Command}) {
        return Object.keys(commands)
            .filter(commandAlias => commands[commandAlias] instanceof Plugin)
            .filter(pluginAlias => commands[pluginAlias].name === pluginAlias)
            .map(pluginAlias => commands[pluginAlias] as Plugin)
            .sort((a, b) => a.priority - b.priority);
    }

    /**
     * Get command name from the message
     * @param message
     */
    public static parseMessage(message: string): {param: string, commandName: string} {
        message = message.trim();
        const commandName = message.split(' ')[0].substr(1).toLowerCase();
        const param = message.substr(commandName.length + 2);
        return {param, commandName};
    }
}
