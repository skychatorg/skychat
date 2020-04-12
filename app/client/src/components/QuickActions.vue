<!--
    Connected list
-->


<template>
    <div class="quick-actions">

        <div v-for="action in actions"
             @click="onActivate(action.id)"
             class="quick-action"
             :class="'action-' + action.id"
             :title="action.title">
            <div class="icon">
                <i class="material-icons md-14">{{action.icon}}</i>
            </div>
            <div class="action" v-html="getActionText(action.id)"></div>
        </div>
    </div>
</template>

<script>
    import Vue from "vue";

    export default Vue.extend({

        data: function() {
            return {

                actions: [
                    {
                        id: 'yt-toggle',
                        title: "Enable/disable youtube",
                        icon: 'movie'
                    },
                    {
                        id: 'cursor-toggle',
                        title: "Enable/disable cursors",
                        icon: 'mouse'
                    },
                    {
                        id: 'yt-queue',
                        title: "See youtube queue",
                        icon: 'movie'
                    },
                    {
                        id: 'shop',
                        title: "Browse shop",
                        icon: 'shopping_cart'
                    },
                    {
                        id: 'guess',
                        title: "Start a guess the number round",
                        icon: 'casino'
                    },
                ]
            }
        },

        methods: {
            getActionText: function(id) {
                switch (id) {
                    case 'yt-toggle':
                        return `<b>> ${this.user.data.plugins.yt ? 'on' : 'off'}</b>`;
                    case 'cursor-toggle':
                        return `<b>> ${this.user.data.plugins.cursor ? 'on' : 'off'}</b>`;
                    case 'yt-queue':
                        return `<b>Yt queue</b>`;
                    case 'shop':
                        return `<b>Shop</b>`;
                    case 'guess':
                        return `<b>Guess</b>`;
                }
            },
            onActivate: function(id) {
                switch (id) {
                    case 'yt-toggle':
                        return this.$client.ytSetState(! this.user.data.plugins.yt);
                    case 'cursor-toggle':
                        return this.$client.cursorSetState(! this.user.data.plugins.cursor);
                    case 'yt-queue':
                        return this.$client.sendMessage('/yt list');
                    case 'shop':
                        return this.$client.sendMessage('/shop');
                    case 'guess':
                        return this.$client.sendMessage('/guess start');
                }
            },
        },

        computed: {
            user: function() {
                return this.$store.state.user;
            }
        }
    });
</script>

<style lang="scss" scoped>
    .quick-actions {
        padding-top: 40px;
        color: white;
        display: flex;
        flex-wrap: wrap;
        flex-direction: row;

        .quick-action {
            flex: 0 calc(50% - 18px);
            height: 30px;
            color: white;
            background: #2b2b2f;
            border-left: 4px solid #a3a5b4;
            transition: all 0.2s;
            display: flex;
            padding: 5px;
            margin: 5px;
            cursor: pointer;
            user-select: none;

            &:hover {
                border-width: 0;
                margin-left: 9px;
                margin-right: 1px;
                background: #313235;
            }

            >.icon {
                flex-basis: 40px;
                text-align: center;
                display: flex;
                flex-direction: column;
                justify-content: center;
            }
            >.action {
                flex-grow: 1;
                display: flex;
                flex-direction: column;
                justify-content: center;
            }
        }

        .action-yt-toggle .icon {
            color: #ff8f8f;
        }
        .action-yt-queue .icon {
            color: #ff8f8f;
        }
        .action-cursor-toggle .icon {
            color: #9b71b9;
        }
        .action-shop .icon {
            color: #e0a067;
        }
        .action-guess .icon {
            color: #6ee067;
        }
    }
</style>
