<template>
    <div class="calendar-container">

        <!-- State buttons -->
        <button @click="view = view === 'week' ? 'month' : 'week'">
            Show {{ view === 'week' ? 'month' : 'week' }} view
        </button>

        <!-- Calendar -->
        <calendar
            class="tui-calendar"
            ref="calendar"
            :view="view"
            :calendars="calendars"
            :schedules="schedules"
            :task-view="false"
            :schedule-view="['time']"
            :week="{ startDayOfWeek: 0, }"
            :month="{ startDayOfWeek: 0, }"
            :is-read-only="true"
            :usage-statistics="false"
            :theme="theme"
        ></calendar>
    </div>
</template>

<script>
    import Vue from "vue";
    import { mapGetters } from 'vuex';
    import 'tui-calendar/dist/tui-calendar.css';
    import { Calendar } from '@toast-ui/vue-calendar';

    export default Vue.extend({

        components: { Calendar },
        
        data: function() {
            return {
                calendars: [],
                schedules: [],
                view: 'week',
                theme: {
                    'common.border': '1px solid #444', // edited
                    'common.backgroundColor': '#242427', // edited
                    'common.holiday.color': 'white', // edited
                    'common.saturday.color': 'white', // edited
                    'common.dayname.color': 'white', // edited
                    'common.today.color': 'white', // edited

                    // month header 'dayname'
                    'month.dayname.borderLeft': '1px solid #444', // edited

                    // month day grid cell 'day'
                    'month.holidayExceptThisMonth.color': 'rgba(255, 64, 64, 0.4)',
                    'month.dayExceptThisMonth.color': 'rgba(51, 51, 51, 0.4)',
                    'month.weekend.backgroundColor': 'inherit',

                    // month more view
                    'month.moreView.border': '1px solid #d5d5d5',
                    'month.moreView.boxShadow': '0 2px 6px 0 rgba(0, 0, 0, 0.1)',
                    'month.moreView.backgroundColor': 'inherit',
                    'month.moreViewTitle.backgroundColor': 'inherit',
                    'month.moreViewTitle.borderBottom': 'none',

                    // week header 'dayname'
                    'week.dayname.borderTop': '1px solid #444', // edited
                    'week.dayname.borderBottom': '1px solid #444', // edited
                    'week.dayname.borderLeft': 'inherit',
                    'week.dayname.backgroundColor': 'inherit',
                    'week.today.color': 'white', // edited
                    'week.pastDay.color': '#999', // edited

                    // week vertical panel 'vpanel'
                    'week.vpanelSplitter.border': '1px solid #444', // edited

                    // week daygrid 'daygrid'
                    'week.daygrid.borderRight': 'none', // edited
                    'week.daygrid.backgroundColor': 'inherit',

                    'week.daygridLeft.backgroundColor': 'inherit',
                    'week.daygridLeft.borderRight': 'none', // edited

                    'week.today.backgroundColor': 'rgba(81, 92, 230, 0.05)',
                    'week.weekend.backgroundColor': 'inherit',

                    // week timegrid 'timegrid'
                    'week.timegridLeft.width': '72px',
                    'week.timegridLeft.backgroundColor': '#242427', // edited
                    'week.timegridLeft.borderRight': 'none', // edited
                    'week.timegridLeft.fontSize': '11px',
                    'week.timegridLeftTimezoneLabel.height': '40px',
                    'week.timegridLeftAdditionalTimezone.backgroundColor': 'white', // edited

                    'week.timegridOneHour.height': '52px',
                    'week.timegridHalfHour.height': '26px',
                    'week.timegridHalfHour.borderBottom': 'none',
                    'week.timegridHorizontalLine.borderBottom': 'none', // edited

                    'week.timegrid.paddingRight': '8px',
                    'week.timegrid.borderRight': '1px solid #444', // edited
                    'week.timegridSchedule.borderRadius': '2px',
                    'week.timegridSchedule.paddingLeft': '2px',

                    'week.currentTime.color': '#515ce6', // edited

                    'week.pastTime.color': '#bbb', // edited
                    'week.futureTime.color': 'white', // edited

                    'week.currentTimeLinePast.border': '1px dashed #515ce6',
                    'week.currentTimeLineBullet.backgroundColor': '#515ce6',
                    'week.currentTimeLineToday.border': '1px solid #515ce6',

                    // week creation guide style
                    'week.creationGuide.color': '#515ce6',
                }
            };
        },

        mounted: function() {
            this.buildCalendar();
        },

        watch: {
            'clientState.playerChannels': {
                deep: true,
                handler() { this.buildCalendar(); },
            },
        },

        methods: {
            buildCalendar: function() {
                this.calendars = this.clientState.playerChannels.map(channel => ({
                    id: channel.id.toString(),
                    name: channel.name,
                    color: 'white',
                }));
                this.schedules = [].concat(
                    ... this.clientState.playerChannels.map(channel =>
                            channel.schedule.events.map(event => ({
                                id: `${channel.id}:${event.start}`,
                                calendarId: channel.id.toString(),
                                category: 'time',
                                title: event.media.title,
                                start: new Date(event.start).toISOString(),
                                end: new Date(event.start + event.duration).toISOString(),
                            })))
                );
                Vue.nextTick(() => {
                    console.log(this.$refs.calendar);
                });
                console.log(this.calendars, this.schedules);
            },
        },

        computed: {
            ...mapGetters('SkyChatClient', [
                'clientState',
            ]),
        },
    });
</script>

<style lang="scss" >
    .calendar-container {
        overflow: hidden;
        height: 100%;
    }

    .tui-calendar {
        height: 100%;

        .tui-full-calendar-weekday-schedule-title {
            color: white !important;
        }

        .tui-full-calendar-popup-container {
            background-color: #333 !important;
            color: white !important;
        }
    }
</style>
