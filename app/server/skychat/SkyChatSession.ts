import {Session} from "../generic-server/Session";
import {SkyChatUser} from "./SkyChatUser";


/**
 * A SkyChatSession represents a connected client
 */
export class SkyChatSession extends Session {

    /**
     * Associated user (if logged session)
     */
    user?: SkyChatUser;

    /**
     * Load session data
     */
    public async load(): Promise<void> {

    }
}
