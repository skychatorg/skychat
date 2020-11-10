<template>

    <div class="mt-2 pr-2 pl-1">

        <!-- rank progress bar -->
        <div class="progress-bar">

            <!-- Progress bar -->
            <div class="progress-bar-progress" :style="{width: xpProgressPct + '%'}"></div>

            <!-- Rank icons -->
            <div class="rank current-rank" :title="'Current rank unlocked at ' + currentRank.limit + ' xp'"><img :src="'/assets/images/' + currentRank.rank"></div>
            <div class="rank next-rank" :title="'Next rank at ' + nextRank.limit + ' xp'" v-if="nextRank"><img :src="'/assets/images/' + nextRank.rank"></div>
        </div>

    </div>
</template>

<script>
    import Vue from "vue";

    export default Vue.extend({
        data: function() {
            return {

            }
        },
        computed: {
            user: function() {
                return this.$store.state.user;
            },
            config: function() {
                return this.$store.state.config;
            },
            xpProgressPct: function() {
                if (! this.nextRank) {
                    return 0;                
                }
                return Math.floor(100 * (this.user.xp - this.currentRank.limit) / (this.nextRank.limit - this.currentRank.limit));
            },
            currentRank: function() {
                return this.config.ranks.filter(rank => this.user.xp >= rank.limit)[0];
            },
            nextRank: function() {
                const remainingRanks = this.config.ranks.filter(rank => this.user.xp < rank.limit);
                if (remainingRanks.length === 0) {
                    return null;
                }
                return remainingRanks[remainingRanks.length - 1];
            }
        }
    });
</script>

<style lang="scss" scoped>

.progress-bar {
    width: 100%;
    border: 4px solid #2c2d31;
    background-color: #2c2d31;
    border-radius: 22px;
    height: 18px;
    position: relative;

    >.rank {
        position: absolute;
        top: -10px;

        &.current-rank {
            left: 0;
        }
        
        &.next-rank {
            right: 0;
        }
    }

    .progress-bar-progress {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        background-color: #8b3742;
        border-top-left-radius: 22px;
        border-bottom-left-radius: 22px;
    }
}

</style>
