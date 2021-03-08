<template>

    <div class="quick-actions">

        <div class="quick-actions-group"
            v-for="group in actions"
            :key="group.name"
            v-show="(cinemaMode && group.showInCinema) || (! cinemaMode && group.showInNonCinema)">
            <div class="quick-actions-group-content">
                <div v-for="action in group.actions"
                     :key="action.id"
                     @click="onActivate(action.id)"
                     class="quick-action"
                     :class="'action-' + action.id"
                     :title="group.name + ': ' + action.title + (action.shortcuts ? ' ' + action.shortcuts.map(shortcut => '['+shortcut+']').join(', ') : '')">

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
    import YoutubeVideoSearcher from "./YoutubeVideoSearcher.vue";

    export default Vue.extend({

        data: function() {
            return {

                actions: [
                    {
                        name: "Youtube",
                        showInCinema: false,
                        showInNonCinema: true,
                        actions: [
                            {
                                id: 'yt-toggle',
                                title: "Enable/disable youtube",
                                icon: 'movie',
                                shortcuts: ['ctrl+shift+y']
                            },
                            /*{
                                id: 'yt-queue',
                                title: "See youtube queue",
                                icon: 'queue_music'
                            },*/
                            {
                                id: 'yt-play',
                                title: "Play a youtube video",
                                icon: 'play_arrow',
                                shortcuts: ['ctrl+p']
                            },
                            {
                                id: 'yt-skip',
                                title: "Skip current video",
                                icon: 'skip_next',
                                shortcuts: ['ctrl+shift+delete']
                            },
                        ]
                    },
                    {
                        name: "Misc",
                        showInCinema: false,
                        showInNonCinema: true,
                        actions: [
                            {
                                id: 'cursor-toggle',
                                title: "Enable/disable cursors",
                                icon: 'mouse',
                                shortcuts: ['ctrl+shift+c']
                            },
                            {
                                id: 'cinema-mode',
                                title: "Toggle cinema mode",
                                icon: 'tv',
                                shortcuts: ['alt+enter']
                            },
                            {
                                id: 'help',
                                title: "See available commands",
                                icon: 'help',
                                shortcuts: ['ctrl+h']
                            },
                        ]
                    },
                    {
                        name: "Misc (Cinema)",
                        showInCinema: true,
                        showInNonCinema: false,
                        actions: [
                            {
                                id: 'cinema-mode',
                                title: "Toggle cinema mode",
                                icon: 'tv',
                                shortcuts: []
                            },
                        ]
                    },
                    {
                        name: "Shop",
                        showInCinema: false,
                        showInNonCinema: true,
                        actions: [
                            {
                                id: 'shop-color',
                                title: "Browse shop colors",
                                icon: 'palette',
                                shortcuts: ['ctrl+s+1']
                            },
                            {
                                id: 'shop-halo',
                                title: "Browse shop halo colors",
                                icon: 'brush',
                                shortcuts: ['ctrl+s+2']
                            },
                            {
                                id: 'shop-pinnedicon',
                                title: "Browse shop",
                                icon: 'info',
                                shortcuts: ['ctrl+s+3']
                            },
                        ]
                    },
                    {
                        name: "Games",
                        showInCinema: false,
                        showInNonCinema: true,
                        actions: [
                            {
                                id: 'guess',
                                title: "Start a guess the number round",
                                icon: 'not_listed_location',
                                shortcuts: ['ctrl+g']
                            },
                            {
                                id: 'roll',
                                title: "Start a game of roulette",
                                icon: 'casino',
                                shortcuts: ['ctrl+r']
                            },
                        ]
                    },
                ]
            }
        },

        created: function() {

            for (const actionGroup of this.actions) {
                for (const action of actionGroup.actions) {
                    for (const shortcut of action.shortcuts || []) {
                        this.$mousetrap.bind(shortcut, (event) => {
                            event.preventDefault();
                            this.onActivate(action.id);
                        });
                    }
                }
            }
        },

        methods: {
            getActionText: function(id) {
                switch (id) {
                    case 'yt-toggle':
                        return `<i class="material-icons md-16" style="color:${this.user.data.plugins.yt ? '' : 'gray'}">toggle_${this.user.data.plugins.yt ? 'on' : 'off'}</i>`;
                    case 'cursor-toggle':
                        return `<i class="material-icons md-16" style="color:${this.user.data.plugins.cursor ? '' : 'gray'}">toggle_${this.user.data.plugins.cursor ? 'on' : 'off'}</i>`;
                    case 'yt-queue':
                        return `<b>List</b>`;
                    case 'yt-skip':
                        return `<b>Skip</b>`;
                    case 'yt-play':
                        return `<b>Play</b>`;
                    case 'shop-color':
                        return `<b>Color</b>`;
                    case 'shop-halo':
                        return `<b>Halo</b>`;
                    case 'shop-pinnedicon':
                        return `<b>Icon</b>`;
                    case 'guess':
                        return `<b>Guess</b>`;
                    case 'roll':
                        return `<b>Roll</b>`;
                    case 'help':
                        return `<b>Help</b>`;
                    case 'cinema-mode':
                        return `<i class="material-icons md-16" style="color:${this.cinemaMode ? '' : 'gray'}">toggle_${this.cinemaMode ? 'on' : 'off'}</i>`;
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
                    case 'yt-play':
                        this.$modal.show(YoutubeVideoSearcher);
                        return;
                    case 'shop-color':
                        return this.$client.sendMessage('/shoplist color');
                    case 'shop-halo':
                        return this.$client.sendMessage('/shoplist halo');
                    case 'shop-pinnedicon':
                        return this.$client.sendMessage('/shoplist pinnedicon');
                    case 'guess':
                        return this.$client.sendMessage('/guess start');
                    case 'roll':
                        return this.$client.sendMessage('/roll start');
                    case 'help':
                        return this.$client.sendMessage('/help');
                    case 'cinema-mode':
                        return this.$store.commit('TOGGLE_CINEMA_MODE'); 
                }
            },
        },

        computed: {
            cinemaMode: function() {
                return this.$store.state.cinemaMode;
            },
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
                    background: #242427;
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

                    &.action-yt-toggle,
                    &.action-yt-queue,
                    &.action-yt-skip,
                    &.action-yt-play {
                        border-left-color: #ff8f8f !important;
                        .icon {
                            color: #ff8f8f;
                        }
                    }
                    &.action-shop-pinnedicon,
                    &.action-shop-color,
                    &.action-shop-halo {
                        border-left-color: #9b71b9 !important;
                        .icon {
                            color: #9b71b9;
                        }
                    }
                    &.action-help,
                    &.action-cinema-mode,
                    &.action-cursor-toggle {
                        border-left-color: #e0a067 !important;
                        .icon {
                            color: #e0a067;
                        }
                    }
                    &.action-guess ,
                    &.action-roll {
                        border-left-color: #6ee067 !important;
                        .icon {
                            color: #6ee067;
                        }
                    }
                }
            }
        }
    }
</style>
