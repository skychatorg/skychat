import Vue from "vue";
import Vuex, { StoreOptions } from "vuex";
import { RootState } from './RootState';
import {SanitizedUser} from "../../../server/skychat/User";
import {SanitizedMessage} from "../../../server/skychat/Message";
import {SanitizedYoutubeVideo} from "../../../server/skychat/commands/impl/YoutubePlugin";
Vue.use(Vuex);

const store: StoreOptions<RootState> = {
    state: {
        user: {
            id: 0,
            username: '*Hamster0',
            money: 0,
            xp: 0,
            right: -1,
            data: {
                plugins: {
                    avatar: "https://risibank.fr/cache/stickers/d666/66604-thumb.png",
                    cursor: true,
                    moto: "",
                }
            }
        },
        connectedList: [],
        messages: [],
        currentVideo: null,
    },
    mutations: {

        SET_USER(state: RootState, user: SanitizedUser): void {
            state.user = user;
        },

        SET_CONNECTED_LIST(state: RootState, users: SanitizedUser[]): void {
            state.connectedList = users;
        },

        NEW_MESSAGE(state: RootState, message: SanitizedMessage): void {
            state.messages.push(message);
        },

        SET_CURRENT_VIDEO(state: RootState, currentVideo: SanitizedYoutubeVideo): void {
            state.currentVideo = currentVideo;
        }
    }
};

export default new Vuex.Store<RootState>(store);
