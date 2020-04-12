<!--
    Player
-->


<template>
    <div @contextmenu.prevent="$emit('select')" class="message" :style="{'border-left-color': message.user.data.plugins.color}">
        <div class="avatar image-bubble">
            <img :src="message.user.data.plugins.avatar">
        </div>
        <div class="content">
            <div class="user" :style="{'color': message.user.data.plugins.color}">{{message.user.username}}</div>

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
            <div ref="formatted" class="formatted" v-html="message.formatted"></div>
        </div>
        <div class="date">
            {{formattedDate}}
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
        watch: {
            'message.formatted': function() {
                this.bindContentLoaded();
            }
        },
        mounted: function() {
            this.bindContentLoaded();
        },
        methods: {
            bindContentLoaded: function() {
                // Get images
                const images = Array.from(this.$refs.formatted.getElementsByTagName('img'));
                for (const image of images) {
                    image.addEventListener('load', () => {
                        this.$emit('content-loaded');
                    });
                }
                // Get buttons
                const buttons = Array.from(this.$refs.formatted.getElementsByClassName('skychat-button'));
                for (const button of buttons) {
                    button.addEventListener('click', () => {
                        this.$client.sendMessage(button.dataset.action);
                    });
                }
            }
        },
        computed: {
            formattedDate: function() {
                const date = new Date(this.message.createdTimestamp * 1000);
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                const seconds = date.getSeconds().toString().padStart(2, '0');
                return `${hours}:${minutes}:${seconds}`;
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
        border-left: 4px solid #a3a5b4;
        padding: 10px 10px 10px 12px;
        -webkit-transition: all 0.2s;
        -moz-transition: all 0.2s;
        -ms-transition: all 0.2s;
        -o-transition: all 0.2s;
        transition: all 0.2s;
        transition-property: border-width, margin-left;

        &:hover {
            border-width: 0;
            margin-left: 4px;
            background: #313235;
        }

        >.avatar {
            width: 40px;
            height: 40px;
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
                font-weight: 800;
                font-size: 110%;
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
                margin-left: 4px;
            }
        }
        >.date {
            font-size: 70%;
        }
    }
</style>
