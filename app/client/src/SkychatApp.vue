<template>
    <div class="page" :class="'mobile-page-' + mobileCurrentPage">
        <cursor-overlay id="cursor-overlay"/>
        <app-header @logout="onLogout" @login="onLogin" id="header"/>
        <div class="page">

            <!-- Auth page -->
            <auth-page
                v-if="page === 'welcome'"
                @gotoroom="gotoRoom"
                id="auth-page"/>

            <!-- Tchat -->
            <tchat-page
                v-if="page === 'room'"
                id="content"></tchat-page>
        </div>
    </div>
</template>


<script>
import Vue from "vue";
import AuthPage from "./pages/AuthPage.vue";
import TchatPage from "./pages/TchatPage.vue";
import AppHeader from "./AppHeader.vue";
import CursorOverlay from "./components/overlay/CursorOverlay.vue";
import AnimatedBackgroundOverlay from "./components/overlay/AnimatedBackgroundOverlay.vue";
import { mapGetters, mapActions } from "vuex";

export default Vue.extend({
    components: { AuthPage, AppHeader, TchatPage, CursorOverlay, AnimatedBackgroundOverlay },
    mounted: function() {
        this.$mousetrap.bind(Array.from({length: 9}).map((_, i) => `alt+${i + 1}`), (event) => {
            event.preventDefault();
            const index = parseInt(event.key) - 1;
            const room = this.clientState.rooms[index];
            if (! room) {
                return;
            }
            this.joinRoom(room.id);
        });
    },
    methods: {
        ...mapActions('App', [
            'setPage',
        ]),
        ...mapActions('SkyChatClient', [
            'joinRoom',
            'logout',
        ]),
        onLogout: function() {
            this.logout();
            this.setPage('welcome');
        },
        onLogin: function() {
            this.setPage('welcome');
        },
        gotoRoom() {
            this.setPage('room');
        },
    },
    computed: {
        ...mapGetters('App', [
            'page',
            'mobileCurrentPage',
        ]),
        ...mapGetters('SkyChatClient', [
            'clientState',
        ]),
    },
});
</script>

<style lang="scss" scoped>
    .page {
        width: 100%;
        height: 100%;
        margin: 0 auto;
        overflow: hidden;
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        position: relative;

        >#cursor-overlay {
            position: absolute;
        }

        >#content {
            flex-grow: 1;
        }
    }
</style>
