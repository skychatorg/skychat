import {SkyChatClient} from "./skychat/SkyChatClient";


declare module 'vue/types/vue' {
    interface Vue {
        $client: SkyChatClient;
    }
}
