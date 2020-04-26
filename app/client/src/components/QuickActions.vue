<template>

    <div class="quick-actions">

        <div class="quick-actions-group" v-for="group in actions">
            <div class="quick-actions-group-content">
                <div v-for="action in group.actions"
                     @click="onActivate(action.id)"
                     class="quick-action"
                     :class="'action-' + action.id"
                     :title="group.name + ': ' + action.title">

                    <div class="icon">
                        <i class="material-icons md-14">{{action.icon}}</i>
                    </div>

                    <div class="action" v-html="getActionText(action.id)"></div>
                </div>
            </div>
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
                        name: "Youtube",
                        actions: [
                            {
                                id: 'yt-toggle',
                                title: "Enable/disable youtube",
                                icon: 'movie'
                            },
                            {
                                id: 'yt-queue',
                                title: "See youtube queue",
                                icon: 'queue_music'
                            },
                            {
                                id: 'yt-skip',
                                title: "Skip current video",
                                icon: 'skip_next'
                            },
                        ]
                    },
                    {
                        name: "Misc",
                        actions: [
                            {
                                id: 'cursor-toggle',
                                title: "Enable/disable cursors",
                                icon: 'mouse'
                            },
                            {
                                id: 'shop',
                                title: "Browse shop",
                                icon: 'shopping_cart'
                            },
                        ]
                    },
                    {
                        name: "Games",
                        actions: [
                            {
                                id: 'guess',
                                title: "Start a guess the number round",
                                icon: 'not_listed_location'
                            },
                            {
                                id: 'roll',
                                title: "Start a game of roulette",
                                icon: 'casino'
                            },
                        ]
                    },
                ]
            }
        },

        methods: {
            getActionText: function(id) {
                switch (id) {
                    case 'yt-toggle':
                        return `<b>${this.user.data.plugins.yt ? 'On' : 'Off'}</b>`;
                    case 'cursor-toggle':
                        return `<b>${this.user.data.plugins.cursor ? 'On' : 'Off'}</b>`;
                    case 'yt-queue':
                        return `<b>List</b>`;
                    case 'yt-skip':
                        return `<b>Skip</b>`;
                    case 'shop':
                        return `<b>Shop</b>`;
                    case 'guess':
                        return `<b>Guess</b>`;
                    case 'roll':
                        return `<b>Roll</b>`;
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
                    case 'yt-skip':
                        return this.$client.sendMessage('/yt skip');
                    case 'shop':
                        return this.$client.sendMessage('/shop');
                    case 'guess':
                        return this.$client.sendMessage('/guess start');
                    case 'roll':
                        return this.$client.sendMessage('/roll start');
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
        padding-top: 20px;
        color: white;

        .quick-actions-group {

            .quick-actions-group-title {
                padding-left: 6px;
            }

            .quick-actions-group-content {
                display: flex;
                flex-wrap: wrap;
                flex-direction: row;

                .quick-action {
                    flex: 0 calc(33% - 14px);
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
            }
        }

        .action-yt-toggle,
        .action-yt-queue,
        .action-yt-skip {
            border-left-color: #ff8f8f !important;
            .icon {
                color: #ff8f8f;
            }
        }
        .action-cursor-toggle,
        .action-shop {
            border-left-color: #9b71b9 !important;
            .icon {
                color: #9b71b9;
            }
        }
        .action-guess ,
        .action-roll {
            border-left-color: #6ee067 !important;
            .icon {
                color: #6ee067;
            }
        }
    }
</style>
