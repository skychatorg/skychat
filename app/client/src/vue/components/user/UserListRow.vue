<template>
    <hover-card
        :clickable="true"
        :selected="false"
        class="user-list-row"
        :class="{
            'disconnected': session.connectionCount === 0,
        }"
    >
        <div class="connected-session"
            :class="{
                'selected': isChanSelected(session.user.username),
                'disconnected': session.connectionCount === 0,
            }">
            <div class="avatar">
                <div class="image-bubble" :style="{ 'border-color': session.user.data.plugins.halo ? session.user.data.plugins.color : '#afafaf' }">
                    <img :src="session.user.data.plugins.avatar">
                </div>
            </div>
            <div class="info">
                <div class="session" :style="{ 'color': session.user.data.plugins.color }">
                    {{session.user.username}}
                    <sup v-show="session.connectionCount > 1">
                        {{session.connectionCount}}
                    </sup>
                </div>
                <div class="meta">
                    <template v-if="session.connectionCount === 0">
                        <div class="icons">
                            <i :title="'User has disconnected ' + durationSinceDead + ' ago'" class="material-icons md-14 icon-disconnected">link_off</i>
                            <span :title="'User has disconnected ' + durationSinceDead + ' ago'" class="text-disconnected">{{durationSinceDead}}</span>
                        </div>
                    </template>
                    <template v-else>
                        <div class="icons">
                            <i v-show="session.user.data.plugins.pinnedicon" class="pinned-icon material-icons md-14" :style="{ 'color': session.user.data.plugins.color }">{{ session.user.data.plugins.pinnedicon }}</i>
                            <template v-if="minutesSinceLastMessage > 0">
                                <i :title="'Last message sent ' + minutesSinceLastMessage + ' minutes ago'" class="material-icons md-14 icon-active-time">schedule</i>
                                <span :title="'Last message sent ' + minutesSinceLastMessage + ' minutes ago'" class="text-active-time">{{minutesSinceLastMessage > 30 ? 'afk' : (minutesSinceLastMessage + 'm')}}</span>
                            </template>
                        </div>
                        <div class="motto" :title="session.user.data.plugins.motto">
                            {{session.user.data.plugins.motto}}
                        </div>
                    </template>
                </div>
            </div>
            <div class="stats" v-show="session.user.right >= 0">
                <div class="right" title="Right level">
                    <span>{{session.user.right}}</span>
                </div>
            </div>
        </div>
    </hover-card>
</template>

<script>
    import Vue from "vue";
    import { mapState } from "vuex";
    import HoverCard from "../util/HoverCard";

    export default Vue.extend({
        components: { HoverCard },
        props: {
            session: {
                type: Object
            }
        },
        methods: {
            isChanSelected(channelName) {
                return channelName.toLowerCase() === this.channel;
            },
        },
        computed: {
            ...mapState('Main', [
                'channel',
            ]),
            minutesSinceLastMessage: function() {
                const duration = new Date().getTime() * 0.001 - this.session.lastMessageTime;
                return Math.floor(duration / 60);
            },
            durationSinceDead: function() {
                if (! this.session.deadSinceTime) {
                    return '';
                }
                const duration = new Date().getTime() * 0.001 - this.session.deadSinceTime;
                if (duration > 60) {
                    return Math.floor(duration / 60) + 'm';
                }
                return Math.floor(duration) + 's';
            }
        }
    });
</script>

<style lang="scss" scoped>

.user-list-row {
    margin-top: 2px;

    .connected-session {
        width: 100%;
        height: 55px;
        display: flex;
        color: white;
        background: #242427;
        transition: all .2s;

        &.disconnected {
            opacity: .6;
        }

        &:hover {
            background: #313235;
        }

        >.avatar {
            width: 55px;
            height: 55px;
            padding: 10px;
            position: relative;
            
            >.image-bubble {
                width: 100%;
                height: 100%;
                border-style: solid;
                border-width: 3px;
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

            >.session {
                display: inline;
                color: #afafaf;
                font-weight: 800;
                font-size: 110%;
                flex-basis: 20px;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-bottom: 4px;
            }
            >.meta {

                display: flex;

                >.icons {
                    margin-top: 2px;
                    flex-grow: 1;

                    >.icon-yt {
                        color: #ff8f8f;
                    }
                    >.icon-cursor {
                        color: #9b71b9;
                    }
                    >.icon-active-time {
                        color: #8ecfff;
                    }
                    >.icon-disconnected {
                        color: #ff8f8f;
                    }
                    >.text-disconnected {
                        color: #ff8f8f;
                        vertical-align: top;
                    }
                    >.text-active-time {
                        color: #8ecfff;
                        vertical-align: top;
                    }
                    >.icon-unread-count {
                        color: #acff98;
                    }
                    >.text-unread-count {
                        color: #acff98;
                        vertical-align: top;
                    }
                }
                >.motto {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    margin-top: 2px;
                    flex-basis: calc(100% - 110px);
                    text-align: right;
                }
            }
        }
        >.stats {
            flex-basis: 70px;
            text-align: right;
            padding-right: 14px;
            font-size: 100%;
            font-weight: 600;
            padding-top: 10px;

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
        }
    }
}
</style>
