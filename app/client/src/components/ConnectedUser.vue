<template>
    <div class="connected-session"
         :style="{'border-left-color': session.user.data.plugins.color}"
         :class="{
            'selected': isChanSelected(session.user.username),
            'has-unread': getUnreadCount(session.user.username) > 0
          }">
        <div class="avatar">
            <div class="image-bubble">
                <img :src="session.user.data.plugins.avatar">
            </div>
        </div>
        <div class="info">
            <div class="session"
                 :style="{'color': session.user.data.plugins.color}">
                {{session.user.username}}
                <sup v-show="session.connectionCount > 1">
                    {{session.connectionCount}}
                </sup>
            </div>
            <div class="moto">{{session.user.data.plugins.moto}}&nbsp;</div>
            <div class="meta">
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
            }
        }
    });
</script>

<style lang="scss" scoped>

    .connected-session {
        width: 100%;
        height: 70px;
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
            width: 70px;
            height: 70px;
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
                margin-bottom: 4px;
                font-size: 110%;
            }
            >.moto {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-top: 0;
            }
            >.meta {

                margin-top: 5px;

                >.icon-yt {
                    color: #ff8f8f;
                }
                >.icon-cursor {
                    color: #9b71b9;
                }
                >.icon-active-time {
                    color: #8ecfff;
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
        }
        >.stats {
            flex-basis: 65px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            text-align: right;
            padding-right: 10px;
            font-size: 100%;
            font-weight: 600;

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
