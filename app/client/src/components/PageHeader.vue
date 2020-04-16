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
                    <p>{{user.username}}</p>
                    <span v-show="user.right === -1" @click="$emit('login')" class="logout-button">login</span>
                    <span v-show="user.right >= 0" @click="$emit('logout')" class="logout-button">logout</span>
                </div>
                <div class="image-bubble nav-avatar">
                    <img :src="user.data.plugins.avatar">
                </div>
            </div>
        </nav>
    </header>
</template>

<script>
    import Vue from "vue";

    export default Vue.extend({

        computed: {
            user: function() {
                return this.$store.state.user;
            },
            borderBottomColor: function() {
                const state = this.$store.state.connectionState;
                switch (state) {

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
        background: #18191c;
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
        max-width: 1100px;
        margin: 0 auto;
        height: 100%;
        display: flex;

        .nav-title {
            text-decoration: none;
            display: flex;
            width: 200px;
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
                box-shadow: 1px 1px 13px #ffffff38;
                border: 1px solid #ffffff47;
                width: 32px;
                height: 32px;
            }
        }
    }
</style>
