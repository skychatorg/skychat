<template>
    <div class="room-list">

        <div v-for="room in rooms"
            :key="room.id"
            class="room"
            :class="{
                'selected': currentRoom === room.id,
                'has-unread': user.id > 0 && (user.data.plugins.lastseen[room.id] || 0) < room.lastReceivedMessageId
            }"
            @click="joinRoom(room.id)"
        >
            <span class="material-icons md-18 room-icon">tag</span>
            <div class="room-name" :title="room.name">
                <b>{{room.name}}<sup v-show="roomConnectedCounts[room.id]">{{roomConnectedCounts[room.id]}}</sup></b>
            </div>
            <div class="room-meta">
                <div class="last-activity"
                    title="Date of the last sent message in this room"
                    v-show="room.id != currentRoom">
                    <i class="material-icons md-14 icon-active-time">schedule</i>
                    <span> {{getLastMessageDurationText(room)}}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
    import Vue from "vue";

    export default Vue.extend({
        components: { },
        props: { },
        methods: {
            joinRoom: function(id) {
                this.$client.joinRoom(id);
            },
            minutesSinceLastMessage: function(room) {
                const duration = new Date().getTime() - room.lastReceivedMessageTimestamp;
                return Math.floor(duration / 1000 / 60);
            },
            getLastMessageDurationText: function(room) {
                const duration = this.minutesSinceLastMessage(room);
                if (duration > 30) {
                    return '>30m';
                }
                if (duration > 1) {
                    return `${duration}m`;
                }
                return 'now';
            }
        },
        computed: {
            rooms: function() {
                return this.$store.state.rooms;
            },
            currentRoom: function() {
                return this.$store.state.currentRoom;
            },
            roomConnectedCounts: function() {
                return this.$store.state.roomConnectedCounts;
            },
            user: function() {
                return this.$store.state.user;
            },
        },
    });
</script>

<style lang="scss" scoped>

.room-list {
    padding-top: 20px;
    padding-right: 10px;
    padding-left: 10px;
    color: white;

    .room {
        width: 100%;
        height: 35px;
        display: flex;
        color: white;
        background: #242427;
        margin-top: 4px;
        border-left: 4px solid #a3a5b4;
        transition: all 0.2s;
        cursor: pointer;

        &.has-unread {
            background: #e2b14152;
        }

        &:hover:not(.selected) {
            border-width: 0;
            margin-left: 4px;
            background: #313235;
        }

        &.selected {
            margin-left: 8px;
            background: #424248;
        }

        .room-icon {
            margin-top: 10px;
            margin-left: 4px;
        }

        .room-name {
            flex-grow: 1;
            margin-top: 10px;
            margin-left: 4px;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
        }

        .room-meta {
            flex-basis: 65px;
            margin-top: 10px;
            margin-right: 6px;
            display: flex;
            flex-direction: row-reverse;

            .last-activity {
                color: #8ecfff;
                span { vertical-align: top; }
            }
        }
    }
}

</style>
