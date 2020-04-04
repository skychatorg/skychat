import {SanitizedUser} from "../../../server/skychat/User";
import {SanitizedMessage} from "../../../server/skychat/Message";

export interface RootState {
    user: SanitizedUser;
    connectedList: SanitizedUser[];
    messages: SanitizedMessage[];
}
