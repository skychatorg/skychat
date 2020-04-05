<!--
    Player
-->


<template>
    <div @click="$emit('select')" class="message">
        <div class="avatar image-bubble">
            <img :src="message.user.data.plugins.avatar">
        </div>
        <div class="content">
            <div class="user">{{message.user.username}}</div>

            <!-- first quote -->
            <div class="quote" v-if="message.quoted">
                <div class="quote-user">{{message.quoted.user.username}}:</div>
                <!-- second quote -->
                <div class="quote" v-if="message.quoted.quoted">
                    <div class="quote-user">{{message.quoted.quoted.user.username}}:</div>
                    <div class="quote-content" v-html="message.quoted.quoted.formatted"></div>
                </div>
                <div class="quote-content" v-html="message.quoted.formatted"></div>
            </div>
            <div class="formatted" v-html="message.formatted"></div>
        </div>
        <div class="date">
            {{new Date(message.createdTimestamp * 1000).toDateString()}}
        </div>
    </div>
</template>

<script>
    import Vue from "vue";
    export default Vue.extend({

        props: {
            message: {
                type: Object,
                required: true,
            }
        },
    });
</script>

<style lang="scss" scoped>

    .message {
        display: flex;
        color: white;
        background: #2b2b2f;
        margin-top: 4px;
        border-left: 4px solid #a3a5b4;
        padding: 10px 10px 10px 12px;
        -webkit-transition: all 0.2s;
        -moz-transition: all 0.2s;
        -ms-transition: all 0.2s;
        -o-transition: all 0.2s;
        transition: all 0.2s;
        cursor: pointer;

        &:hover {
            border-width: 0;
            margin-left: 4px;
            background: #313235;
        }

        >.avatar {
            width: 30px;
            height: 30px;
            box-shadow: 1px 1px 10px 0px #ffffff78;
        }

        >.content {
            flex-grow: 1;
            margin-left: 16px;
            width: 0;
            word-break: break-all;
            display: flex;
            flex-direction: column;

            >.user {
                display: inline;
                color: #a3a5b4;
            }

            .quote {
                margin: 10px;
                padding: 4px 10px;
                border-left: 5px solid grey;

                >.quote-user {
                    font-size: 80%;
                }
                >.quote-content {
                    margin-top: 5px;
                    margin-left: 4px;
                }
            }

            >.formatted {
                margin-top: 3px;
            }
        }
        >.date {
            font-size: 70%;
        }
    }
</style>
