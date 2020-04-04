<!--
    Player
-->


<template>
    <div class="message">
        <div class="user">
            {{message.user.username}}
        </div>
        <div class="content">
            {{message.content}}
        </div>
        <div class="date">
            14:39:06
        </div>
    </div>
</template>

<script lang="ts">
    import Vue from "vue";
    export default Vue.extend({

        props: {
            message: {
                type: Object
            }
        },

        data: function() {
            return {
                message: {
                    user: {
                        username: 'Parser'
                    },
                    content: 'hello world',
                    date: new Date().getTime()
                }
            }
        }
    });
</script>

<style lang="scss" scoped>

    .message {
        display: flex;
        color: white;
        background: #2b2b2f;
        margin-top: 4px;
        border-left: 6px solid #f71b1b;
        padding: 10px 10px 10px 16px;

        >.user {
            width: 100px;
            color: #f71b1b;
        }
        >.content {
            flex-grow: 1;
        }
        >.date {

        }
    }
</style>
