<template>
    <div class="page" :class="'mobile-page-' + mobileCurrentPage">
        <cursor-overlay id="cursor-overlay"/>
        <app-header @logout="logout" @login="login" id="header"/>
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

    export default Vue.extend({
        components: { AuthPage, AppHeader, TchatPage, CursorOverlay, AnimatedBackgroundOverlay },
        mounted: function() {
            this.$mousetrap.bind(Array.from({length: 9}).map((_, i) => `alt+${i + 1}`), (event) => {
                event.preventDefault();
                const index = parseInt(event.key) - 1;
                const room = this.rooms[index];
                if (! room) {
                    return;
                }
                this.$client.joinRoom(room.id);
            });
        },
        methods: {
            logout: function() {
                this.$client.logout();
                this.$store.dispatch('Main/setPage', 'welcome');
            },
            login: function() {
                this.$store.dispatch('Main/setPage', 'welcome');
            },
            gotoRoom() {
                this.$store.dispatch('Main/setPage', 'room');
            },
        },
        computed: {
            rooms: function() {
                return this.$store.state.Main.rooms;
            },
            page: function() {
                return this.$store.state.Main.page;
            },
            mobileCurrentPage: function() {
                return this.$store.state.Main.mobileCurrentPage;
            }
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
