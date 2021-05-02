<template>

    <div class="quick-actions">
        <h2 class="title">Quick actions</h2>
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
    import YoutubeVideoSearcher from "../modal/YoutubeVideoSearcher.vue";

    export default Vue.extend({

        data: function() {
            return {

                actions: [
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
                            {
                                id: 'yt-lock',
                                title: "Lock this room's video player",
                                icon: 'lock',
                                shortcuts: ['alt+a']
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
                        ]
                    },
                    {
                        name: "Shop",
                        showInCinema: false,
                        showInNonCinema: true,
                        actions: [
                            {
                                id: 'shop',
                                title: "Browse shop",
                                icon: 'palette',
                                shortcuts: []
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
                        name: "Games",
                        showInCinema: false,
                        showInNonCinema: false,
                        actions: [
                            {
                                id: 'racing',
                                title: "Start a race car game",
                                icon: 'flag',
                                shortcuts: ['ctrl+r']
                            },
                            {
                                id: 'roll',
                                title: "Start a game of roulette",
                                icon: 'casino',
                                shortcuts: ['ctrl+o']
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
                        return `<i class="material-icons md-16" style="color:${this.playerEnabled ? '' : 'gray'}">toggle_${this.playerEnabled ? 'on' : 'off'}</i>`;
                    case 'cursor-toggle':
                        return `<i class="material-icons md-16" style="color:${this.user.data.plugins.cursor ? '' : 'gray'}">toggle_${this.user.data.plugins.cursor ? 'on' : 'off'}</i>`;
                    case 'yt-queue':
                        return `<b>List</b>`;
                    case 'yt-lock':
                        return `<i class="material-icons md-16" style="color:${typeof this.user.data.plugins.yt === 'number' ? '' : 'gray'}">toggle_${typeof this.user.data.plugins.yt === 'number' ? 'on' : 'off'}</i>`;
                    case 'yt-play':
                        return `<b>Play</b>`;
                    case 'shop':
                        return `<b>Shop</b>`;
                    case 'shop-color':
                        return `<b>Color</b>`;
                    case 'shop-halo':
                        return `<b>Halo</b>`;
                    case 'shop-pinnedicon':
                        return `<b>Icon</b>`;
                    case 'racing':
                        return `<b>Racing</b>`;
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
                        this.$store.commit('SET_PLAYER_ENABLED', ! this.playerEnabled);
                        this.$client.ytSync();
                        return;
                    case 'cursor-toggle':
                        return this.$client.cursorSetState(! this.user.data.plugins.cursor);
                    case 'yt-queue':
                        return this.$client.sendMessage('/yt list');
                    case 'yt-lock':
                        if (typeof this.user.data.plugins.yt === 'number') {
                            return this.$client.sendMessage('/yt unlock');
                        } else {
                            return this.$client.sendMessage('/yt lock');
                        }
                    case 'yt-play':
                        this.$modal.show(YoutubeVideoSearcher);
                        return;
                    case 'shop':
                        return this.$client.sendMessage('/shop');
                    case 'shop-color':
                        return this.$client.sendMessage('/shoplist color');
                    case 'shop-halo':
                        return this.$client.sendMessage('/shoplist halo');
                    case 'shop-pinnedicon':
                        return this.$client.sendMessage('/shoplist pinnedicon');
                    case 'racing':
                        return this.$client.sendMessage('/racing start');
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
            },
            playerEnabled: function() {
                return this.$store.state.playerEnabled;
            },
        }
    });
</script>

<style lang="scss" scoped>
    .quick-actions {
        padding-left: 10px;
        padding-bottom: 5px;
        padding-right: 5px;
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
                    flex: 0 calc(50% - 10px);
                    height: 30px;
                    color: white;
                    background: #242427;
                    border-left: 4px solid #a3a5b4;
                    transition: all 0.2s;
                    display: flex;
                    margin: 0 10px 4px 0px;
                    cursor: pointer;
                    user-select: none;

                    &:hover {
                        border-width: 0;
                        margin-left: 5px;
                        margin-right: 5px;
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
                    &.action-yt-lock,
                    &.action-yt-play {
                        border-left-color: #ff8f8f !important;
                        .icon {
                            color: #ff8f8f;
                        }
                    }
                    &.action-shop,
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
                    &.action-racing,
                    &.action-guess,
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
