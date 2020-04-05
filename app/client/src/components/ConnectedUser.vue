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
            <div class="user">{{user.username}}</div>
            <div class="moto">{{user.data.plugins.moto}}</div>
        </div>
        <div class="stats">
            <div class="right">
                level {{user.right}}
            </div>
            <div class="xp">
                <span>xp {{user.xp}}</span>
            </div>
            <div class="money">
                $ {{user.money}}
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
        height: 50px;
        display: flex;
        color: white;
        background: #2b2b2f;
        margin-top: 4px;
        border-left: 4px solid #a3a5b4;
        transition: all 0.2s;
        cursor: pointer;

        &:hover {
            border-width: 0;
            margin-left: 4px;
            background: #313235;
        }

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

            >.user {
                display: inline;
                color: #a3a5b4;
            }
            >.moto {
                font-size: 80%;
                margin-left: 10px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-top: 4px;
            }
        }
        >.stats {
            flex-basis: 45px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            text-align: right;
            padding-right: 10px;

            >* {
                display: flex;
                justify-content: center;
                flex-direction: column;
            }
            >.right {
                flex-grow: 1;
                font-size: 80%;
                color: #4484e4;
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
