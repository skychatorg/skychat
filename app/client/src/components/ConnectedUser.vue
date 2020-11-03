<template>
    <div class="connected-session"
         :style="{'border-left-color': session.user.data.plugins.color.main}"
         :class="{
            'selected': isChanSelected(session.user.username),
            'has-unread': getUnreadCount(session.user.username) > 0
          }">
        <div class="avatar">
            <div class="image-bubble" :style="{'box-shadow': '0 0 4px 4px ' + session.user.data.plugins.color.secondary}">
                <img :src="session.user.data.plugins.avatar">
            </div>
        </div>
        <div class="info">
            <div class="session"
                 :style="{'color': session.user.data.plugins.color.main}">
                <i v-show="session.user.data.plugins.pinnedicon" class="pinned-icon material-icons md-14">{{session.user.data.plugins.pinnedicon}}</i>
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
                    <span class="rank">
                        <img title="User rank" :src="'/assets/images/' + session.user.rank">
                    </span>
                    <div class="icons">
                        <i class="material-icons md-14 icon-yt" v-show="session.user.data.plugins.yt" title="Youtube enabled">movie</i>
                        <i class="material-icons md-14 icon-cursor" v-show="session.user.data.plugins.cursor" title="Cursors enabled">mouse</i>
                        <template v-if="minutesSinceLastMessage > 0">
                            <i title="Last activity" class="material-icons md-14 icon-active-time">schedule</i>
                            <span class="text-active-time">{{minutesSinceLastMessage > 30 ? 'afk' : (minutesSinceLastMessage + 'm')}}</span>
                        </template>
                        <template v-if="getUnreadCount(session.user.username) > 0">
                            <i title="New messages" class="material-icons md-14 icon-unread-count">email</i>
                            <span class="text-unread-count">{{getUnreadCount(session.user.username)}}️</span>
                        </template>
                    </div>
                    <div class="moto" :title="session.user.data.plugins.moto">{{session.user.data.plugins.moto}}&nbsp;</div>
                </template>
            </div>
        </div>
        <div class="stats" v-show="session.user.right >= 0">
            <div class="right" title="Right level">
                <span>{{session.user.right}}</span>
            </div>
            <div class="xp" title="User xp">
                <span>{{session.user.xp}}</span>
            </div>
            <div class="money" title="Money">
                $ {{(session.user.money / 100).toFixed(2)}}
            </div>
        </div>
    </div>
</template>

<script>
    import Vue from "vue";

    export default Vue.extend({

        props: {
            session: {
                type: Object
            }
        },

        methods: {
            isChanSelected(channelName) {
                return channelName.toLowerCase() === this.$store.state.channel;
            },
            getUnreadCount(channelName) {
                channelName = channelName.toLowerCase();
                if (typeof this.$store.state.privateMessages[channelName] === 'undefined') {
                    return 0;
                }
                return this.$store.state.privateMessages[channelName].unreadCount;
            },
        },

        computed: {
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

    .connected-session {
        width: 100%;
        height: 55px;
        display: flex;
        color: white;
        background: #2b2b2f;
        margin-top: 4px;
        border-left: 4px solid #a3a5b4;
        transition: all 0.2s;
        cursor: pointer;

        &.has-unread {
            background: #e2b14152;
        }

        &.selected {
            margin-left: 10px;
            background: #424248;
        }

        &:hover:not(.selected) {
            border-width: 0;
            margin-left: 4px;
            background: #313235;
        }

        >.avatar {
            width: 55px;
            height: 55px;
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

            >.session {
                display: inline;
                color: #a3a5b4;
                font-weight: 800;
                font-size: 110%;
                flex-basis: 20px;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-bottom: 4px;
            }
            >.meta {

                display: flex;

                >.rank {
                    height: 24px;
                    >img {
                        height: 100%;
                    }
                }
                >.icons {
                    margin-left: 5px;
                    margin-top: 5px;
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
                >.moto {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    margin-top: 5px;
                    flex-basis: 110px;
                    text-align: right;
                }
            }
        }
        >.stats {
            flex-basis: 70px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            text-align: right;
            padding-right: 10px;
            font-size: 100%;
            font-weight: 600;
            padding-top: 4px;
            padding-bottom: 4px;

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
