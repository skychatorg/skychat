<!--
    Player
-->


<template>
    <div class="connected-user">
        <div class="avatar">
            <div class="image-bubble">
                <img :src="user.data.plugins.avatar">
            </div>
        </div>
        <div class="info">
            <div class="username">{{user.username}}</div>
            <div class="moto">{{user.data.plugins.moto}}</div>
        </div>
    </div>
</template>

<script>
    import Vue from "vue";

    export default Vue.extend({

        props: {
            user: {
                type: Object
            }
        },
    });
</script>

<style lang="scss" scoped>

    .connected-user {
        width: 100%;
        height: 50px;
        display: flex;
        color: white;
        background-color: #15141429;
        margin-top: 4px;
        border-left: 4px solid #b7b7b7;

        >.avatar {
            width: 50px;
            height: 50px;
            padding: 10px;

            >.image-bubble{
                width: 100%;
                height: 100%;
            }
        }
        >.info {
            padding-top: 6px;
            position: relative;
            flex-grow: 1;
            width: 0;
            display: flex;
            flex-direction: column;

            >.moto {
                font-size: 80%;
                margin-left: 10px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                width: 250px;
            }
        }
    }
</style>
