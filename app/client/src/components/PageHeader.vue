<!--
    Global page header
-->


<template>
    <header>
        <nav class="nav">

            <!-- logo top left -->
            <div class="nav-title">
                <img class="logo" src="assets/logo.png"/>
                <p class="title">SkyChat</p>
            </div>

            <!-- user info top right -->
            <div class="nav-user">
                <div class="username">
                    <p>{{user.username}}</p>
                </div>
                <div class="image-bubble nav-avatar">
                    <img :src="user.data.plugins.avatar">
                </div>
            </div>
        </nav>
    </header>
</template>

<script lang="ts">
    import Vue from "vue";
    export default Vue.extend({

        computed: {
            user: function() {
                return this.$store.state.user;
            }
        }
    });
</script>

<style lang="scss" scoped>

    $header-height: 60px;

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
        max-width: 1400px;
        margin: 0 auto;
        height: 100%;
        display: flex;

        .nav-title {
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
                margin-top: 10px;
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
                padding-top: 10px;
            }

            .image-bubble.nav-avatar {
                box-shadow: 1px 1px 13px #ffffff38;
                border: 1px solid #ffffff47;
                width: 42px;
                height: 42px;
            }
        }
    }
</style>
