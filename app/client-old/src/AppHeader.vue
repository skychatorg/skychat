<template>
    <header :style="{'border-bottom-color': borderBottomColor}">
        <nav class="nav">

            <!-- logo top left -->
            <a href="./" class="nav-title">
                <img class="logo" src="assets/logo.png"/>
                <p class="title">SkyChat</p>
            </a>

            <!-- user info top right -->
            <div class="nav-user">
                <div class="username">
                    <p>{{clientState.user.username}}</p>
                    <span v-show="clientState.user.right === -1" @click="$emit('login')" class="logout-button">login</span>
                    <span v-show="clientState.user.right >= 0" @click="$emit('logout')" class="logout-button">logout</span>
                </div>
                <div class="image-bubble nav-avatar" @click="onAvatarClick" title="Change avatar">
                    <img :src="clientState.user.data.plugins.avatar">
                </div>
            </div>
        </nav>
        <input ref="file" @change="onSetAvatar" type="file" style="position: fixed; top: -2000px; left: -2000px;" />
    </header>
</template>

<script>
    import Vue from "vue";
import { mapActions, mapGetters } from "vuex";

    export default Vue.extend({

        methods: {
            ...mapActions('SkyChatClient', [
                'sendMessage',
            ]),
            onAvatarClick: function() {
                this.$refs.file.click();
            },
            onSetAvatar: async function() {
                try {
                    const data = new FormData();
                    data.append('file', this.$refs.file.files[0]);
                    const result = await (await fetch("./upload", {method: 'POST', body: data})).json();
                    if (result.status === 500) {
                        throw new Error('Unable to upload: ' + result.message);
                    }
                    this.sendMessage(`/avatar ${document.location.href + result.path}`);
                } catch (e) {
                    new Noty({
                        type: 'error',
                        layout: 'topCenter',
                        theme: 'nest',
                        text: e.message,
                        timeout: 2000
                    }).show();
                }
            },
        },

        computed: {
            ...mapGetters('SkyChatClient', [
                'clientState',
            ]),
            borderBottomColor: function() {
                //const state = this.$store.state.App.connectionState;
                const state = this.clientState.websocketReadyState;
                switch (this.clientState.websocketReadyState) {

                    case WebSocket.CONNECTING:
                    case WebSocket.CLOSED:
                        return 'red';

                    case WebSocket.OPEN:
                        return 'white';

                    default:
                        return 'yellow';
                }
            },
        }
    });
</script>

<style lang="scss" scoped>

    $header-height: 50px;

    header {
        background: #09090a;
        border-bottom: 1px solid #fff;
        width: 100%;
        height: $header-height;
        margin: 0 auto;
        padding: 8px 20px;
        right: 20px;
    }
    img {
        max-height: 100%;
    }
    .nav {
        width: 100%;
        max-width: 1740px;
        margin: 0 auto;
        height: 100%;
        display: flex;

        .nav-title {
            text-decoration: none;
            display: flex;
            width: 160px;
            height: 100%;

            .logo {
                height: 100%;
            }
            .title {
                color: white;
                padding-left: 10px;
                font-family: Russo One,sans-serif;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: .1em;
                font-size: 1.2em;
                margin-top: 5px;
                margin-left: 10px;
            }
        }

        .nav-user {
            flex-grow: 1;
            display: flex;

            .username {
                flex-grow: 1;
                text-align: right;
                color: white;
                padding-right: 20px;

                .logout-button {
                    font-size: 70%;
                    cursor: pointer;
                }
            }

            .image-bubble.nav-avatar {
                cursor: pointer;
                box-shadow: 1px 1px 13px #ffffff38;
                border: 1px solid #ffffff47;
                width: 32px;
                height: 32px;
            }
        }
    }
</style>
