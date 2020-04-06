<!--
    Player
-->


<template>
    <div class="connected-user" :style="{'border-left-color': user.data.plugins.color}">
        <div class="avatar">
            <div class="image-bubble">
                <img :src="user.data.plugins.avatar">
            </div>
        </div>
        <div class="info">
            <div class="user" :style="{'color': user.data.plugins.color}">{{user.username}}</div>
            <div class="moto">{{user.data.plugins.moto}}</div>
        </div>
        <div class="stats" v-show="user.right >= 0">
            <div class="right">
                <span>{{user.right}}</span>
            </div>
            <div class="xp">
                <span>{{user.xp}}</span>
            </div>
            <div class="money">
                $ {{user.money / 100}}
            </div>
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
        height: 70px;
        display: flex;
        color: white;
        background: #2b2b2f;
        margin-top: 4px;
        border-left: 4px solid #a3a5b4;
        transition: all 0.2s;

        &:hover {
            border-width: 0;
            margin-left: 4px;
            background: #313235;
        }

        >.avatar {
            width: 70px;
            height: 70px;
            padding: 10px;

            >.image-bubble{
                width: 100%;
                height: 100%;
            }
        }
        >.info {
            padding-top: 6px;
            padding-left: 4px;
            position: relative;
            flex-grow: 1;
            width: 0;
            display: flex;
            flex-direction: column;

            >.user {
                display: inline;
                color: #a3a5b4;
                font-weight: 800;
                margin-bottom: 4px;
                font-size: 110%;
            }
            >.moto {
                margin-left: 10px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-top: 0;
            }
        }
        >.stats {
            flex-basis: 45px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            text-align: right;
            padding-right: 10px;
            font-size: 100%;
            font-weight: 600;

            >* {
                display: flex;
                justify-content: center;
                flex-direction: column;
            }
            >.right {
                flex-grow: 1;
                font-size: 80%;
                color: #a1c6ff;
            }
            >.money {
                flex-grow: 1;
                font-size: 80%;
                color: #e4e444;
            }
            >.xp {
                flex-grow: 1;
                font-size: 80%;
                color: #ff4747;
            }
        }
    }
</style>
