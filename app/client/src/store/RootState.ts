import {SanitizedUser} from "../../../server/skychat/User";
import {SanitizedMessage} from "../../../server/skychat/Message";
import {SanitizedYoutubeVideo} from "../../../server/skychat/commands/impl/YoutubePlugin";

export interface RootState {
    user: SanitizedUser;
    connectedList: SanitizedUser[];
    messages: SanitizedMessage[];
    currentVideo: SanitizedYoutubeVideo | null;
}
