<script setup>
import MuteButton from '@/components/party/MuteButton.vue';
import MonkeySprite from '@/components/party/MonkeySprite.vue';
import { useCountdown } from '@/composables/useCountdown';
import { useNow } from '@/composables/useNow';
import { createCrowdSound, playCasinoSound, preloadApeRecordings } from '@/lib/casinoSounds';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { betChips } from '@/lib/channel';
import { formatMoney } from '../../../../api/money.ts';
import { computed, onUnmounted, ref, watch } from 'vue';

const TRAITS = {
    berserk: { emoji: '😡', name: 'Berserk', text: 'hits harder when hurt' },
    coward: { emoji: '🐔', name: 'Coward', text: 'dodges a lot, hits soft' },
    banana: { emoji: '🍌', name: 'Banana stash', text: 'heals once' },
    showoff: { emoji: '😎', name: 'Show-off', text: 'big crits, sometimes trips' },
    grudge: { emoji: '😤', name: 'Grudge', text: 'hits back whoever hit it, harder' },
    vampire: { emoji: '🧛', name: 'Vampire', text: 'drinks some of the damage it deals' },
    thrower: { emoji: '🥥', name: 'Coconut thrower', text: 'throws from afar, ignores defense' },
    ninja: { emoji: '🥷', name: 'Ninja', text: 'vanishes from blows, sometimes counters' },
    zombie: { emoji: '🧟', name: 'Undying', text: 'gets back up once after a KO' },
    gorilla: { emoji: '🦍', name: 'Chest beater', text: 'roars: everyone else loses a turn' },
};
/** Actions a monkey does on its own, without leaving its spot */
const SOLO = ['heal', 'trip', 'revive', 'roar', 'stunned'];
/** Actions that throw a coconut instead of a punch, when the thrower does them */
const THROWN = ['hit', 'crit', 'miss'];
/** Comic words for the big blows */
const BANGS = ['POW!', 'BAM!', 'WHAM!', 'KRAK!', 'BONK!', 'SMASH!'];
const VERBS = ['punches', 'mauls', 'headbutts', 'kicks', 'bites', 'smashes', 'body-slams', 'claws'];
const STATS = [
    { key: 'hp', label: 'HP', max: 130 },
    { key: 'attack', label: 'Attack', max: 24 },
    { key: 'defense', label: 'Defense', max: 10 },
    { key: 'speed', label: 'Speed', max: 14 },
];
/** One colour per monkey: its ring in the pit and its bar on the scoreboard */
const COLORS = ['#e0343a', '#3a8bff', '#3fbf5f', '#ffc21a'];
/** Fixed spots in the pit, in %: back left, back right, front left, front right */
const HOMES = [
    { x: 27, y: 52 },
    { x: 73, y: 52 },
    { x: 33, y: 84 },
    { x: 67, y: 84 },
];
/** Each action, as shares of its duration: wind-up, then the dash, the impact and the walk back */
const STEPS = { dash: 0.25, impact: 0.45, back: 0.75 };

const app = useAppStore();
// Muted per game: one game's noise shouldn't silence the others
const soundOn = computed(() => app.gameSound('monkeys'));
const client = useClientStore();
const now = useNow(40);

const fight = computed(() => client.state.monkeyFight);
const me = computed(() => client.state.user);
const myBet = computed(() => fight.value.bets.find((b) => b.user.id === me.value.id) ?? null);
const { seconds: betSeconds } = useCountdown(() => fight.value.deadline);
const times = (hundredths) => `×${(hundredths / 100).toFixed(2)}`;
const surname = (id) => fight.value.monkeys[id].name.split(' ').at(-1);

const events = computed(() => fight.value.events ?? []);
// Ms since the first punch, negative during the intro
const elapsed = computed(() => (fight.value.phase === 'fighting' ? now.value - fight.value.startedAt : Infinity));
const intro = computed(() => fight.value.phase === 'fighting' && elapsed.value < 0);
// Index of the event playing now, -1 before the first punch
const beat = computed(() => {
    if (fight.value.phase === 'betting') {
        return -1;
    }
    let index = -1;
    while (index + 1 < events.value.length && events.value[index + 1].at <= elapsed.value) {
        index++;
    }
    return index;
});
const current = computed(() => (beat.value >= 0 && fight.value.phase === 'fighting' ? events.value[beat.value] : null));
// Where the current action is: windup, dash, impact or back. Null once it is over
const step = computed(() => {
    const event = current.value;
    if (!event) {
        return null;
    }
    const progress = (elapsed.value - event.at) / event.duration;
    if (progress >= 1) {
        return null;
    }
    return progress < STEPS.dash ? 'windup' : progress < STEPS.impact ? 'dash' : progress < STEPS.back ? 'impact' : 'back';
});
// Damage counts from the impact on, not from the wind-up
const landed = computed(() => (step.value === 'windup' || step.value === 'dash' ? beat.value - 1 : beat.value));

const hp = computed(() => {
    const hp = fight.value.monkeys.map((m) => m.stats.hp);
    for (const event of events.value.slice(0, landed.value + 1)) {
        if (event.kind === 'heal' || event.kind === 'revive') {
            hp[event.actor] += event.amount;
        } else {
            hp[event.target] -= event.amount;
        }
        hp[event.actor] += event.gain ?? 0;
    }
    return hp;
});
const over = computed(
    () => fight.value.phase === 'done' || (beat.value === events.value.length - 1 && landed.value === beat.value && !step.value),
);
// Last one standing, or the healthiest when the fight was called on points
const winner = computed(() => {
    if (!over.value || !events.value.length) {
        return null;
    }
    const share = (m) => hp.value[m.id] / m.stats.hp;
    return fight.value.monkeys.filter((m) => hp.value[m.id] > 0).reduce((a, b) => (share(b) > share(a) ? b : a));
});

const trait = (id) => fight.value.monkeys[id].trait;
// The thrower stays home and its coconut flies
const throwing = (event) => event && trait(event.actor) === 'thrower' && THROWN.includes(event.kind);

// Only the attacker moves: to the side of its target for the hit, then back home
const spot = (id) => {
    if (winner.value?.id === id) {
        return { x: 50, y: 70 };
    }
    const event = current.value;
    const attacking =
        event && event.actor === id && event.target !== id && !throwing(event) && (step.value === 'dash' || step.value === 'impact');
    if (!attacking) {
        return HOMES[id];
    }
    const target = HOMES[event.target];
    const side = HOMES[id].x < target.x ? -1 : 1;
    return { x: target.x + side * 11, y: target.y + 1 };
};

const describe = (event, index) => {
    const [a, t] = [surname(event.actor), surname(event.target)];
    const verb = (throwing(event) ? 'pelts' : trait(event.actor) === 'vampire' ? 'bites' : VERBS[index % VERBS.length]).toUpperCase();
    const drank = event.gain ? ` (+${event.gain})` : '';
    if (event.ko) {
        return { text: `${t} IS DOWN!`, kind: 'ko' };
    }
    return {
        hit: { text: `${a} ${verb} ${t} −${event.amount}${drank}`, kind: 'hit' },
        crit: { text: `CRIT! ${a} ${verb} ${t} −${event.amount}${drank}`, kind: 'crit' },
        miss: { text: trait(event.target) === 'ninja' ? `${t} VANISHES` : `${t} DODGES ${a}`, kind: 'miss' },
        heal: { text: `${a} EATS A BANANA +${event.amount}`, kind: 'heal' },
        trip: { text: `${a} TRIPS −${event.amount}`, kind: 'miss' },
        counter: { text: `${a} COUNTERS ${t} −${event.amount}`, kind: 'crit' },
        revive: { text: `${a} GETS BACK UP!`, kind: 'heal' },
        roar: { text: `${a} ROARS! EVERYONE FREEZES`, kind: 'crit' },
        stunned: { text: `${a} IS STUNNED`, kind: 'miss' },
    }[event.kind];
};
// The newest line stays until the next blow lands, the two before it fade out under it: time to read
const captions = computed(() => {
    const lines = events.value.slice(0, landed.value + 1).map((event, index) => ({ ...describe(event, index), key: index }));
    if (winner.value) {
        lines.push({ text: `${surname(winner.value.id)} WINS`, kind: 'win', key: 'win' });
    }
    return lines.slice(-3).reverse();
});

const floater = (event) =>
    ({
        hit: { text: `−${event.amount}`, kind: 'hit' },
        crit: { text: `−${event.amount}`, kind: 'crit' },
        miss: { text: 'MISS', kind: 'miss' },
        heal: { text: `+${event.amount}`, kind: 'heal' },
        trip: { text: `−${event.amount}`, kind: 'miss' },
        counter: { text: `−${event.amount}`, kind: 'crit' },
        revive: { text: `+${event.amount}`, kind: 'heal' },
        roar: { text: 'ROAR!', kind: 'crit' },
        stunned: { text: 'STUNNED', kind: 'miss' },
    })[event.kind];

// Who is frozen right now: everyone a roar caught, until their lost turn has played. The KO'd ones are filtered out on display
const stunned = computed(() => {
    const frozen = new Set();
    for (const event of events.value.slice(0, landed.value + 1)) {
        if (event.kind === 'roar') {
            fight.value.monkeys.forEach((m) => m.id !== event.actor && frozen.add(m.id));
        } else if (event.kind === 'stunned') {
            frozen.delete(event.actor);
        }
    }
    return frozen;
});

const fighters = computed(() =>
    fight.value.monkeys.map((monkey) => {
        const event = current.value;
        const at = spot(monkey.id);
        const involved = event && (event.actor === monkey.id || event.target === monkey.id);
        const target = event && event.target !== event.actor ? event.target : null;
        // Faces whoever it attacks, otherwise the middle of the pit
        const facing = event?.actor === monkey.id && target !== null ? HOMES[target].x : 50;
        const impact = step.value === 'impact';
        const acting = event?.actor === monkey.id;
        const hit = event?.target === monkey.id;
        return {
            ...monkey,
            ...at,
            color: COLORS[monkey.id],
            depth: 0.75 + ((at.y - 50) / 34) * 0.4,
            flip: facing < at.x,
            ko: hp.value[monkey.id] <= 0,
            health: Math.max(0, hp.value[monkey.id]) / monkey.stats.hp,
            winner: winner.value?.id === monkey.id,
            mine: myBet.value?.monkey === monkey.id,
            // Everyone else steps into the dark while an action plays
            // A roar hits everyone, so nobody steps back for it
            dim: Boolean(step.value) && !involved && event.kind !== 'roar',
            marked: step.value && step.value !== 'back' && target === monkey.id,
            emoji: TRAITS[monkey.trait]?.emoji,
            windup: step.value === 'windup' && acting && !SOLO.includes(event.kind),
            throwing: (step.value === 'windup' || step.value === 'dash') && acting && throwing(event),
            striking: impact && acting && ['hit', 'crit', 'miss', 'counter'].includes(event.kind),
            struck: impact && hit && ['hit', 'crit', 'trip', 'counter'].includes(event.kind),
            falling: impact && event.ko && hit,
            vanish: impact && hit && event.kind === 'miss' && monkey.trait === 'ninja',
            rising: impact && acting && event.kind === 'revive',
            roaring: step.value && step.value !== 'back' && acting && event.kind === 'roar',
            dazed: stunned.value.has(monkey.id) && hp.value[monkey.id] > 0,
            pop: impact && hit ? floater(event) : null,
            // What a vampire drank floats up over the vampire
            drank: impact && acting && event.gain ? `+${event.gain}` : null,
            bang: impact && hit && (event.kind === 'crit' || event.ko) ? BANGS[beat.value % BANGS.length] : null,
        };
    }),
);
const shake = computed(() => step.value === 'impact' && (['crit', 'roar', 'counter'].includes(current.value.kind) || current.value.ko));
// A white flash on the big blows
const flash = computed(() => step.value === 'impact' && (current.value.kind === 'crit' || current.value.ko));

// Things flying across the pit: a coconut on its way, a drop of blood back to a vampire
const flying = computed(() => {
    const event = current.value;
    if (!event) {
        return null;
    }
    const at = (id, dx = 0) => ({ x: HOMES[id].x + dx, y: HOMES[id].y - 12 });
    if (throwing(event) && step.value === 'dash') {
        // A dodged coconut sails past
        const miss = event.kind === 'miss' ? (HOMES[event.target].x > HOMES[event.actor].x ? 16 : -16) : 0;
        return { key: `nut-${beat.value}`, emoji: '🥥', kind: 'nut', from: at(event.actor), to: at(event.target, miss) };
    }
    if (event.gain && step.value === 'impact') {
        return { key: `blood-${beat.value}`, emoji: '🩸', kind: 'blood', from: at(event.target), to: at(event.actor) };
    }
    return null;
});

// Dust where an attacker kicks off
const dust = computed(() => {
    const event = current.value;
    if (step.value !== 'dash' || !event || event.actor === event.target || throwing(event)) {
        return null;
    }
    return { key: beat.value, ...HOMES[event.actor] };
});

// Bananas rain on the winner
const BANANAS = Array.from({ length: 14 }, (_, i) => ({ x: (i * 37) % 100, delay: (i * 0.23) % 1.6, spin: (i * 53) % 360 }));
// A KO plays in slow motion, zoomed on the one going down
const slowmo = computed(() => (current.value?.ko && step.value ? HOMES[current.value.target] : null));

// Blood stays on the floor where crits and KOs landed
const splats = computed(() =>
    events.value
        .slice(0, landed.value + 1)
        .map((event, index) => ({ event, index }))
        .filter(({ event }) => event.kind === 'crit' || event.ko)
        .map(({ event, index }) => ({
            index,
            x: HOMES[event.target].x + ((index * 37) % 9) - 4,
            y: HOMES[event.target].y + ((index * 13) % 3) - 1,
            big: event.ko,
        })),
);

// Betting: pick a monkey, then a chip
const selected = ref(null);
watch(
    () => fight.value.fight,
    () => (selected.value = null),
);
const choices = computed(() => betChips(fight.value));
// Until bets close, a bet can move to another monkey or change amount
const canBet = computed(() => me.value.id && fight.value.phase === 'betting');
// Each monkey answers with its own call when picked
const CALLS = ['grunt', 'chatter', 'yelp', 'ooh'];
const choose = (monkey) => {
    if (canBet.value) {
        selected.value = monkey.id;
        sound(CALLS[monkey.id]);
    }
};
const back = (amount) => client.sendMessage(`/party back ${selected.value} ${amount}`);
const backers = (id) =>
    fight.value.bets
        .filter((b) => b.monkey === id)
        .map((b) => b.user.username)
        .join(', ');

const backingLabel = computed(() => {
    const name = fight.value.monkeys[selected.value].name;
    if (!myBet.value) {
        return `Back ${name}`;
    }
    return myBet.value.monkey === selected.value ? `Your bet on ${name}` : `Move your bet to ${name}`;
});

const yourBet = computed(() => {
    if (!me.value.id) {
        return 'Log in to play';
    }
    const mine = myBet.value;
    if (!mine) {
        if (fight.value.phase !== 'betting') {
            return 'Back a monkey on the next fight';
        }
        return selected.value === null ? 'Pick your monkey' : null;
    }
    const name = fight.value.monkeys[mine.monkey].name;
    if (mine.payout === null) {
        return `You backed ${name}, ${formatMoney(mine.bet)} at ${times(fight.value.monkeys[mine.monkey].odds)}`;
    }
    return mine.payout ? `${name} won! +${formatMoney(mine.payout)}` : `${name} lost, ${formatMoney(mine.bet)} gone`;
});
const status = computed(() => {
    if (!fight.value.monkeys.length) {
        return 'Bringing in the fighters…';
    }
    return fight.value.phase === 'betting' ? `Bets close in ${betSeconds.value}s` : yourBet.value;
});

// The crowd murmurs through the fight and roars at the big moments
let crowd = null;
const stopCrowd = () => {
    crowd?.stop();
    crowd = null;
};
const sound = (name, delayMs) => soundOn.value && playCasinoSound(name, delayMs);
watch(
    () => soundOn.value,
    (on) => on && preloadApeRecordings(),
    { immediate: true },
);
watch(
    () => [fight.value.phase, soundOn.value],
    ([phase, on], before) => {
        if (phase === 'fighting' && on) {
            if (!crowd) {
                crowd = createCrowdSound();
                sound('bell');
                sound('hoot', 600);
            }
        } else {
            if (phase === 'done' && before?.[0] === 'fighting' && on) {
                crowd?.roar(1);
                sound('bell');
                sound('hoot', 300);
                sound('chestbeat', 1500);
            }
            setTimeout(stopCrowd, phase === 'done' ? 2500 : 0);
        }
    },
    { immediate: true },
);
onUnmounted(stopCrowd);

// While bets are open the cage is never quiet: a monkey grunts or chatters every few seconds
let cage = null;
const rattle = () => {
    sound(['grunt', 'chatter', 'ooh', 'yelp'][Math.floor(Math.random() * 4)]);
    cage = setTimeout(rattle, 2500 + Math.random() * 3500);
};
watch(
    () => fight.value.phase === 'betting' && soundOn.value,
    (open) => {
        clearTimeout(cage);
        if (open) {
            cage = setTimeout(rattle, 1500);
        }
    },
    { immediate: true },
);
onUnmounted(() => clearTimeout(cage));
watch(betSeconds, (left, before) => left < before && left > 0 && left <= 5 && fight.value.phase === 'betting' && sound('tick'));
// Chips on the table, and the picked monkey approves
watch(
    () => myBet.value && `${myBet.value.monkey}-${myBet.value.bet}`,
    (bet, before) => {
        if (bet && bet !== before) {
            sound('chip');
            sound('chatter', 150);
        }
    },
);
// Sounds land with the blow, not with the wind-up
watch(
    () => step.value === 'impact' && beat.value,
    (index) => {
        const event = current.value;
        if (!soundOn.value || index === false || !event) {
            return;
        }
        if (event.ko) {
            sound('smash');
            sound('screech', 200);
            crowd?.roar(1);
            return;
        }
        if (event.kind === 'crit') {
            crowd?.roar(0.6);
        }
        const thrown = throwing(event);
        sound(
            {
                hit: thrown ? 'bonk' : 'punch',
                crit: thrown ? 'bonk' : 'smash',
                miss: trait(event.target) === 'ninja' ? 'poof' : 'whoosh',
                heal: 'chomp',
                trip: 'punch',
                counter: 'slash',
                revive: 'revive',
                roar: 'roar',
                stunned: 'dizzy',
            }[event.kind],
        );
        if (event.kind === 'miss') {
            crowd?.roar(0.3);
            // The one who dodged mocks the other
            sound('chatter', 250);
        }
        if (event.kind === 'roar' || event.kind === 'revive') {
            crowd?.roar(0.7);
        }
        if (event.gain) {
            sound('slurp', 120);
        }
        // And how the one on the receiving end feels about it
        const cry = { hit: 'yelp', crit: 'scream', trip: 'chatter', heal: 'ooh', counter: 'scream', stunned: 'ooh' }[event.kind];
        if (cry) {
            sound(cry, 70);
        }
    },
);
watch(
    () => step.value === 'dash' && beat.value,
    (index) => {
        const event = current.value;
        if (index === false || !event || event.actor === event.target) {
            return;
        }
        sound(throwing(event) ? 'throw' : 'whoosh');
        sound('grunt');
    },
);
watch(
    () => myBet.value?.payout,
    (payout, before) => {
        if (soundOn.value && before === null && payout !== null && payout !== undefined) {
            playCasinoSound(payout ? 'win' : 'lose', 600);
        }
    },
);
</script>

<template>
    <div class="monkeys">
        <div class="frame" :class="fight.phase">
            <div class="top">
                <span class="title">Monkey Fight</span>
                <span class="status" aria-live="polite">{{ status }}</span>
                <MuteButton game="monkeys" />
            </div>

            <!-- Betting: who they are, what they're worth -->
            <template v-if="fight.phase === 'betting'">
                <div class="lineup">
                    <button
                        v-for="monkey in fight.monkeys"
                        :key="`${fight.fight}-${monkey.id}`"
                        class="card"
                        :class="{ selected: selected === monkey.id, mine: myBet?.monkey === monkey.id, pickable: canBet }"
                        :style="{ '--color': COLORS[monkey.id] }"
                        :aria-pressed="selected === monkey.id"
                        :aria-label="`${monkey.name}, odds ${times(monkey.odds)}`"
                        @click="choose(monkey)"
                    >
                        <span class="portrait"><MonkeySprite :skin="monkey.skin" /></span>
                        <span class="name">{{ monkey.name }}</span>
                        <span class="odds">{{ times(monkey.odds) }}</span>
                        <span class="stats">
                            <span v-for="stat in STATS" :key="stat.key" class="stat">
                                <span class="label">{{ stat.label }}</span>
                                <span class="track"><span :style="{ width: `${(100 * monkey.stats[stat.key]) / stat.max}%` }"></span></span>
                            </span>
                        </span>
                        <span class="trait">trait: ???</span>
                        <span class="backers">{{ backers(monkey.id) }}</span>
                    </button>
                </div>
                <div class="bottom">
                    <div v-if="canBet && selected !== null" class="chips" role="group" :aria-label="`Back ${fight.monkeys[selected].name}`">
                        <button
                            v-for="choice in choices"
                            :key="choice"
                            class="chip"
                            :class="{ current: myBet?.monkey === selected && myBet.bet === choice }"
                            :disabled="me.money + (myBet?.bet ?? 0) < choice"
                            @click="back(choice)"
                        >
                            {{ formatMoney(choice) }}
                        </button>
                        <!-- After the chips, so its changing length never moves them -->
                        <span class="backing">{{ backingLabel }}</span>
                    </div>
                    <p v-else-if="yourBet" class="hint">{{ yourBet }}</p>
                </div>
            </template>

            <!-- The pit, seen from above at an angle -->
            <template v-else>
                <div class="pit" :class="{ shake }">
                    <div
                        class="scene"
                        :class="{ slowmo, zoom: flash && !slowmo }"
                        :style="slowmo ? { transformOrigin: `${slowmo.x}% ${slowmo.y}%` } : {}"
                    >
                        <div class="floor"></div>
                        <div class="fence"></div>
                        <span v-if="dust" :key="`dust-${dust.key}`" class="dust" :style="{ left: `${dust.x}%`, top: `${dust.y}%` }"></span>
                        <span
                            v-if="flying"
                            :key="flying.key"
                            class="flying"
                            :class="flying.kind"
                            :style="{
                                '--x0': `${flying.from.x}%`,
                                '--y0': `${flying.from.y}%`,
                                '--x1': `${flying.to.x}%`,
                                '--y1': `${flying.to.y}%`,
                            }"
                            aria-hidden="true"
                            ><span>{{ flying.emoji }}</span></span
                        >
                        <template v-if="winner">
                            <span
                                v-for="(banana, i) in BANANAS"
                                :key="`banana-${i}`"
                                class="banana"
                                :style="{ left: `${banana.x}%`, animationDelay: `${banana.delay}s`, '--spin': `${banana.spin}deg` }"
                                aria-hidden="true"
                                >🍌</span
                            >
                        </template>
                        <span
                            v-for="splat in splats"
                            :key="`splat-${splat.index}`"
                            class="splat"
                            :class="{ big: splat.big }"
                            :style="{ left: `${splat.x}%`, top: `${splat.y}%` }"
                        ></span>
                        <div
                            v-for="monkey in fighters"
                            :key="`${fight.fight}-${monkey.id}`"
                            class="fighter"
                            :class="{ ko: monkey.ko, winner: monkey.winner, dim: monkey.dim, vanish: monkey.vanish }"
                            :style="{
                                left: `${monkey.x}%`,
                                top: `${monkey.y}%`,
                                '--depth': monkey.depth,
                                '--color': monkey.color,
                                zIndex: Math.round(monkey.y * 10),
                            }"
                        >
                            <span class="ring" :class="{ marked: monkey.marked }"></span>
                            <!-- Over the head, so the fight can be followed without looking away -->
                            <span v-if="!monkey.ko" class="bar">
                                <span :style="{ width: `${100 * monkey.health}%` }"></span>
                            </span>
                            <span class="facing" :class="{ flip: monkey.flip }">
                                <span
                                    class="body"
                                    :class="{
                                        windup: monkey.windup,
                                        throwing: monkey.throwing,
                                        striking: monkey.striking,
                                        struck: monkey.struck,
                                        falling: monkey.falling,
                                        rising: monkey.rising,
                                        roaring: monkey.roaring,
                                    }"
                                >
                                    <MonkeySprite :skin="monkey.skin" :ko="monkey.ko" />
                                </span>
                            </span>
                            <span v-if="monkey.emoji && !monkey.ko" class="badge" :title="TRAITS[monkey.trait].name">{{
                                monkey.emoji
                            }}</span>
                            <span v-if="monkey.dazed" class="dazed" aria-hidden="true">💫</span>
                            <span v-if="monkey.struck" class="burst" aria-hidden="true"></span>
                            <span v-if="monkey.vanish" class="smoke" aria-hidden="true">💨</span>
                            <span v-if="monkey.rising" class="aura" aria-hidden="true"></span>
                            <span v-if="monkey.roaring" class="shock" aria-hidden="true"></span>
                            <span v-if="monkey.bang" class="bang" aria-hidden="true">{{ monkey.bang }}</span>
                            <span v-if="monkey.pop" class="pop" :class="monkey.pop.kind">{{ monkey.pop.text }}</span>
                            <span v-if="monkey.drank" class="pop heal">{{ monkey.drank }}</span>
                        </div>
                    </div>
                    <ol v-if="captions.length" class="captions" aria-live="polite">
                        <li v-for="(line, i) in captions" :key="line.key" class="caption" :class="[line.kind, `age-${i}`]">
                            {{ line.text }}
                        </li>
                    </ol>
                    <div v-if="flash" :key="`flash-${beat}`" class="flash" aria-hidden="true"></div>
                    <div v-if="intro" class="overlay" aria-hidden="true"><span class="fight-word">FIGHT!</span></div>
                </div>

                <!-- Scoreboard: never moves, so it is always readable -->
                <div class="board">
                    <div
                        v-for="monkey in fighters"
                        :key="`board-${fight.fight}-${monkey.id}`"
                        class="entry"
                        :class="{ ko: monkey.ko, winner: monkey.winner, mine: monkey.mine }"
                        :style="{ '--color': monkey.color }"
                        :title="`${monkey.name}: ${TRAITS[monkey.trait].name}, ${TRAITS[monkey.trait].text}`"
                    >
                        <span class="face"><MonkeySprite :skin="monkey.skin" :ko="monkey.ko" /></span>
                        <span class="info">
                            <span class="entry-name"
                                >{{ monkey.winner ? '👑 ' : monkey.ko ? '💀 ' : '' }}{{ monkey.name }} {{ monkey.emoji }}</span
                            >
                            <span class="hp">
                                <span :style="{ width: `${(100 * Math.max(0, hp[monkey.id])) / monkey.stats.hp}%` }"></span>
                            </span>
                            <span class="entry-backers">{{ backers(monkey.id) || 'no bets' }}</span>
                        </span>
                    </div>
                </div>
            </template>
        </div>
    </div>
</template>

<style scoped>
.monkeys {
    container-type: size;
    width: 100%;
    height: 100%;
}
.frame {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: radial-gradient(ellipse at 50% 30%, #2a1414, #0b0909 75%);
    color: #ece4dc;
}
.top {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: clamp(3px, 1.5cqh, 10px) clamp(8px, 2cqw, 20px);
    font-size: clamp(12px, 3.6cqh, 15px);
}
.title {
    font-weight: 900;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #e0343a;
    white-space: nowrap;
}
.status {
    flex: 1;
    min-width: 0;
    color: rgb(255 255 255 / 0.75);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Betting line-up */
.lineup {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: clamp(4px, 1.5cqw, 14px);
    padding: 0 clamp(8px, 2cqw, 20px);
}
.card {
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(1px, 0.8cqh, 5px);
    padding: clamp(2px, 1cqh, 8px) 6px;
    border-radius: 12px;
    border: 2px solid rgb(255 255 255 / 0.06);
    border-top: 3px solid var(--color);
    background: linear-gradient(180deg, rgb(255 255 255 / 0.04), rgb(0 0 0 / 0.3));
    cursor: default;
    transition:
        border-color 0.15s,
        background 0.15s;
}
.card.pickable {
    cursor: pointer;
}
.card.pickable:hover {
    border-color: rgb(224 52 58 / 0.5);
}
.card.selected,
.card.mine {
    border-color: #e0343a;
    background: linear-gradient(180deg, rgb(224 52 58 / 0.2), rgb(0 0 0 / 0.3));
}
.portrait {
    flex: 1;
    min-height: 0;
    width: 100%;
    display: flex;
    justify-content: center;
}
.portrait :deep(svg) {
    height: 100%;
    width: auto;
    max-width: 100%;
}
.name {
    max-width: 100%;
    font-weight: 800;
    font-size: clamp(11px, 3.6cqh, 15px);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.odds {
    font:
        800 clamp(12px, 4cqh, 18px) ui-monospace,
        monospace;
    color: #ffc21a;
}
.stats {
    width: 100%;
    display: grid;
    gap: 2px;
}
.stat {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    color: rgb(255 255 255 / 0.6);
}
.label {
    width: 44px;
    text-align: left;
}
.track {
    flex: 1;
    height: 5px;
    border-radius: 3px;
    background: rgb(255 255 255 / 0.08);
    overflow: hidden;
}
.track span {
    display: block;
    height: 100%;
    background: #c23a3a;
}
.trait {
    font-size: 11px;
    color: rgb(255 255 255 / 0.4);
}
.backers {
    /* Always one line tall, even empty, so the cards don't jump when someone bets */
    min-height: 1.4em;
    line-height: 1.4;
    max-width: 100%;
    font-size: 11px;
    color: rgb(255 255 255 / 0.6);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.bottom {
    height: clamp(30px, 13cqh, 60px);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 clamp(8px, 2cqw, 20px);
    overflow: hidden;
}
.chips {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: nowrap;
    min-width: 0;
}
.backing {
    margin-left: 6px;
    font-weight: 800;
    font-size: 13px;
    white-space: nowrap;
}
.chip {
    min-height: 34px;
    padding: 0 12px;
    border-radius: 10px;
    font-weight: 800;
    background: rgb(224 52 58 / 0.15);
    border: 1px solid rgb(224 52 58 / 0.5);
}
.chip:hover:not(:disabled) {
    background: rgb(224 52 58 / 0.3);
}
.chip.current {
    background: #e0343a;
    border-color: #ff8a8e;
}
.chip:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}
.hint {
    margin: 0;
    font-size: 13px;
    color: rgb(255 255 255 / 0.8);
    white-space: nowrap;
}

/* The pit */
.pit {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    --m: clamp(24px, 24cqh, 120px);
}
.pit::before {
    /* A hard light from above */
    content: '';
    position: absolute;
    inset: -20% 15% 0;
    background: radial-gradient(ellipse at 50% 60%, rgb(255 236 200 / 0.12), transparent 60%);
    pointer-events: none;
}
.scene {
    position: absolute;
    inset: 0;
    transition: transform 0.5s ease-out;
}
.scene.slowmo {
    transform: scale(1.15);
}
.floor {
    position: absolute;
    left: 8%;
    right: 8%;
    top: 32%;
    bottom: 1%;
    border-radius: 50%;
    background: radial-gradient(circle at 30% 40%, rgb(0 0 0 / 0.25) 0 6%, transparent 7%),
        radial-gradient(circle at 70% 70%, rgb(0 0 0 / 0.2) 0 4%, transparent 5%),
        radial-gradient(ellipse at 50% 45%, #4a3626, #241810 70%, #120c08);
    box-shadow:
        inset 0 -10px 30px rgb(0 0 0 / 0.7),
        0 0 0 3px #1a1310;
}
/* The cage around it */
.fence {
    position: absolute;
    left: 5%;
    right: 5%;
    top: 28%;
    bottom: -4%;
    border-radius: 50%;
    border: 3px solid rgb(170 170 175 / 0.35);
    background: repeating-conic-gradient(from 0deg, rgb(160 160 165 / 0.25) 0 0.6deg, transparent 0.6deg 5deg);
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 10px), #000 calc(100% - 9px));
    mask: radial-gradient(farthest-side, transparent calc(100% - 10px), #000 calc(100% - 9px));
    pointer-events: none;
}
.splat {
    position: absolute;
    width: calc(var(--m) * 0.55);
    height: calc(var(--m) * 0.2);
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: radial-gradient(ellipse, #6e0b0b 40%, rgb(110 11 11 / 0.6) 60%, transparent 72%);
    animation: spill 0.5s ease-out both;
}
.splat.big {
    width: calc(var(--m) * 0.95);
    height: calc(var(--m) * 0.32);
}
.fighter {
    position: absolute;
    width: calc(var(--m) * var(--depth));
    height: calc(var(--m) * var(--depth) * 1.1);
    transform: translate(-50%, -100%);
    transition:
        left 0.28s cubic-bezier(0.6, 0, 0.3, 1),
        top 0.28s cubic-bezier(0.6, 0, 0.3, 1),
        filter 0.25s;
}
/* The spotlight is on the two who fight, everyone else steps back into the dark */
.fighter.dim {
    filter: brightness(0.3) saturate(0.4) blur(1.5px);
}
.bar {
    position: absolute;
    left: 50%;
    bottom: 104%;
    width: clamp(26px, 75%, 80px);
    height: clamp(4px, 1.4cqh, 7px);
    transform: translateX(-50%);
    border-radius: 3px;
    background: rgb(0 0 0 / 0.7);
    box-shadow: 0 0 0 1px rgb(0 0 0 / 0.5);
    overflow: hidden;
}
.bar span {
    display: block;
    height: 100%;
    background: var(--color);
    transition: width 0.3s;
}
.ring {
    position: absolute;
    left: 6%;
    right: 6%;
    bottom: -9%;
    height: 20%;
    border-radius: 50%;
    border: 2px solid var(--color);
    background: radial-gradient(ellipse, rgb(0 0 0 / 0.6), transparent 70%);
    box-shadow: 0 0 8px var(--color);
}
.fighter.ko .ring {
    opacity: 0.25;
}
/* The one about to be hit */
.ring.marked {
    border: 3px solid #fff;
    box-shadow:
        0 0 0 3px #e0343a,
        0 0 16px #e0343a;
}
.facing {
    position: absolute;
    inset: 0;
    display: block;
}
.facing.flip {
    transform: scaleX(-1);
}
.body {
    position: absolute;
    inset: 0;
    display: block;
    transform-origin: 50% 100%;
    /* A thin rim light, so dark fur still reads on the dark floor */
    filter: drop-shadow(0 0 1px rgb(255 230 210 / 0.55)) drop-shadow(0 -2px 3px rgb(255 230 210 / 0.15));
}
.fighter.ko .body {
    transform: translateY(30%) rotate(-88deg) scale(0.9);
    filter: brightness(0.7) saturate(0.6) drop-shadow(0 0 1px rgb(255 230 210 / 0.4));
}
.burst {
    position: absolute;
    left: 50%;
    top: 40%;
    width: 90%;
    aspect-ratio: 1;
    transform: translate(-50%, -50%);
    background: radial-gradient(circle, #fff 0 12%, #ffd27a 22%, rgb(255 120 40 / 0.6) 38%, transparent 62%);
    clip-path: polygon(50% 0, 60% 35%, 98% 20%, 68% 50%, 100% 78%, 60% 64%, 50% 100%, 40% 64%, 2% 80%, 32% 50%, 0 22%, 40% 35%);
    pointer-events: none;
    mix-blend-mode: screen;
}
.pop {
    position: absolute;
    left: 50%;
    top: -10%;
    transform: translateX(-50%);
    z-index: 5;
    font-weight: 900;
    font-size: clamp(14px, 7cqh, 34px);
    white-space: nowrap;
    text-shadow:
        0 2px 6px #000,
        0 0 2px #000;
    pointer-events: none;
}
.pop.hit {
    color: #ff5a5f;
}
.pop.crit {
    color: #ffc21a;
    font-size: clamp(18px, 10cqh, 48px);
}
.pop.miss {
    color: rgb(255 255 255 / 0.85);
}
.pop.heal {
    color: #3fbf5f;
}
/* The trait, revealed when the fight starts */
.badge {
    position: absolute;
    right: -8%;
    top: -2%;
    font-size: calc(var(--m) * var(--depth) * 0.26);
    line-height: 1;
    filter: drop-shadow(0 1px 2px #000);
}
.dazed,
.smoke,
.bang {
    position: absolute;
    left: 50%;
    pointer-events: none;
    line-height: 1;
}
.dazed {
    top: -4%;
    font-size: calc(var(--m) * var(--depth) * 0.3);
    transform: translateX(-50%);
}
.smoke {
    top: 30%;
    font-size: calc(var(--m) * var(--depth) * 0.7);
    transform: translate(-50%, -50%);
}
.bang {
    top: 5%;
    z-index: 6;
    font-weight: 900;
    font-style: italic;
    font-size: clamp(14px, 8cqh, 40px);
    color: #ffe14a;
    -webkit-text-stroke: 2px #8a1010;
    paint-order: stroke;
    transform: translate(-50%, -50%) rotate(-12deg);
    text-shadow: 0 3px 0 #000;
}
.aura {
    position: absolute;
    left: 50%;
    top: 55%;
    width: 160%;
    aspect-ratio: 1;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    background: radial-gradient(circle, rgb(93 255 122 / 0.55), transparent 65%);
    pointer-events: none;
}
.shock {
    position: absolute;
    left: 50%;
    bottom: -8%;
    width: 100%;
    aspect-ratio: 2.4;
    border: 3px solid #ffc21a;
    border-radius: 50%;
    transform: translateX(-50%);
    pointer-events: none;
}
.fighter.vanish .body {
    opacity: 0.08;
}
.flash {
    position: absolute;
    inset: 0;
    z-index: 1400;
    background: #fff;
    opacity: 0;
    pointer-events: none;
}
.dust {
    position: absolute;
    width: calc(var(--m) * 0.8);
    height: calc(var(--m) * 0.25);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    background: radial-gradient(ellipse, rgb(190 160 120 / 0.55), transparent 70%);
    pointer-events: none;
    opacity: 0;
}
.flying {
    position: absolute;
    left: var(--x1);
    top: var(--y1);
    z-index: 1300;
    transform: translate(-50%, -50%);
    font-size: clamp(14px, 7cqh, 32px);
    pointer-events: none;
}
.flying span {
    display: block;
}
.banana {
    position: absolute;
    top: -10%;
    z-index: 1200;
    font-size: clamp(12px, 6cqh, 28px);
    pointer-events: none;
    opacity: 0;
}
.captions {
    position: absolute;
    left: 3%;
    right: 3%;
    top: 3%;
    z-index: 1500;
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    pointer-events: none;
}
.caption {
    max-width: 100%;
    padding: 2px 14px;
    border-radius: 6px;
    background: rgb(0 0 0 / 0.65);
    font-weight: 900;
    font-size: clamp(12px, 5.5cqh, 26px);
    letter-spacing: 0.03em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    pointer-events: none;
}
.caption.crit,
.caption.win {
    color: #ffc21a;
}
.caption.ko {
    color: #ff4a50;
    font-size: clamp(14px, 7cqh, 36px);
}
.caption.miss {
    color: rgb(255 255 255 / 0.8);
}
.caption.heal {
    color: #3fbf5f;
}
.caption.age-1 {
    font-size: clamp(10px, 3.2cqh, 15px);
    opacity: 0.6;
}
.caption.age-2 {
    font-size: clamp(9px, 2.8cqh, 13px);
    opacity: 0.35;
}
.overlay {
    position: absolute;
    inset: 0;
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgb(0 0 0 / 0.35);
    pointer-events: none;
}
.fight-word {
    font-weight: 900;
    font-size: clamp(28px, 24cqh, 140px);
    letter-spacing: 0.04em;
    color: #e0343a;
    text-shadow:
        0 0 30px rgb(224 52 58 / 0.6),
        0 5px 0 #3a0608;
    transform: rotate(-6deg);
}

/* Scoreboard */
.board {
    flex-shrink: 0;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: clamp(4px, 1cqw, 10px);
    padding: clamp(3px, 1.2cqh, 8px) clamp(8px, 2cqw, 20px);
}
.entry {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 6px;
    border-radius: 8px;
    border-left: 4px solid var(--color);
    background: rgb(255 255 255 / 0.05);
    transition: opacity 0.3s;
}
.entry.mine {
    background: rgb(224 52 58 / 0.18);
}
.entry.winner {
    background: rgb(255 194 26 / 0.18);
}
.entry.ko {
    opacity: 0.45;
}
.face {
    width: clamp(20px, 7cqh, 34px);
    aspect-ratio: 100 / 110;
    flex-shrink: 0;
}
.info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.entry-name {
    font-size: clamp(10px, 3cqh, 13px);
    font-weight: 800;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.entry-backers {
    font-size: 10px;
    color: rgb(255 255 255 / 0.55);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.hp {
    height: clamp(4px, 1.4cqh, 7px);
    border-radius: 3px;
    background: rgb(0 0 0 / 0.6);
    overflow: hidden;
}
.hp span {
    display: block;
    height: 100%;
    background: var(--color);
    transition: width 0.3s;
}

@keyframes spill {
    from {
        transform: translate(-50%, -50%) scale(0.2);
    }
}
@media (prefers-reduced-motion: no-preference) {
    .fighter:not(.ko) .body {
        animation: breathe 1.6s ease-in-out infinite;
    }
    .fighter .body.windup {
        animation: crouch 0.3s ease-out forwards;
    }
    .fighter .body.striking {
        animation: strike 0.35s ease-out;
    }
    .fighter .body.struck {
        animation: struck 0.4s ease-out;
    }
    .fighter .body.falling {
        animation: fall 1s cubic-bezier(0.5, 0, 0.8, 0.6) both;
    }
    .fighter .body.throwing {
        animation: throw 0.45s ease-in-out;
    }
    .fighter .body.rising {
        animation: reborn 0.9s ease-out both;
    }
    .fighter .body.roaring {
        animation: roar 0.6s ease-out;
    }
    .fighter.vanish .body {
        animation: vanish 0.5s ease-out;
    }
    .dazed {
        animation: dizzy 0.9s linear infinite;
    }
    .smoke {
        animation: puff 0.6s ease-out forwards;
    }
    .aura {
        animation: aura 0.9s ease-out forwards;
    }
    .shock {
        animation: shock 0.7s ease-out forwards;
    }
    .bang {
        animation: bang 0.6s cubic-bezier(0.3, 1.8, 0.5, 1) forwards;
    }
    .flash {
        animation: flash 0.22s ease-out;
    }
    .dust {
        animation: dust 0.5s ease-out;
    }
    .flying {
        animation: fly 0.28s linear both;
    }
    .flying.nut span {
        animation:
            arc 0.28s ease-in-out,
            spin 0.28s linear;
    }
    .flying.blood {
        animation-duration: 0.35s;
    }
    .banana {
        animation: rain 1.8s ease-in infinite;
    }
    .scene.zoom {
        animation: zoom 0.3s ease-out;
    }
    .fighter.winner .body {
        animation: cheer 0.55s ease-in-out infinite;
    }
    .ring.marked {
        animation: mark 0.4s ease-in-out infinite alternate;
    }
    .burst {
        animation: burst 0.35s ease-out forwards;
    }
    .pop {
        animation: rise 0.9s ease-out forwards;
    }
    .caption {
        animation: drop 0.25s cubic-bezier(0.3, 1.6, 0.5, 1);
    }
    .pit.shake {
        animation: shake 0.3s linear;
    }
    .scene.slowmo .fighter {
        transition-duration: 0.7s;
    }
    .fight-word {
        animation: slam 0.5s cubic-bezier(0.3, 1.6, 0.5, 1) both;
    }
    @keyframes throw {
        40% {
            transform: rotate(-16deg) scaleY(0.9);
        }
        70% {
            transform: rotate(12deg) translateX(10%);
        }
    }
    @keyframes reborn {
        from {
            transform: translateY(30%) rotate(-88deg) scale(0.9);
            filter: brightness(0.6);
        }
        60% {
            transform: translateY(-10%) rotate(8deg);
            filter: brightness(1.8) hue-rotate(60deg);
        }
    }
    @keyframes roar {
        20%,
        60% {
            transform: translateY(-6%) scale(1.3) rotate(-5deg);
        }
        40% {
            transform: translateY(-6%) scale(1.25) rotate(5deg);
        }
    }
    @keyframes vanish {
        from {
            opacity: 1;
        }
        30% {
            opacity: 0.05;
            transform: translateX(-35%) scale(0.8);
        }
    }
    @keyframes dizzy {
        to {
            transform: translateX(-50%) rotate(360deg);
        }
    }
    @keyframes puff {
        from {
            opacity: 1;
            transform: translate(-50%, -50%) scale(0.4);
        }
        to {
            opacity: 0;
            transform: translate(-50%, -100%) scale(1.8);
        }
    }
    @keyframes aura {
        from {
            opacity: 1;
            transform: translate(-50%, -50%) scale(0.3);
        }
        to {
            opacity: 0;
            transform: translate(-50%, -50%) scale(1.4);
        }
    }
    @keyframes shock {
        from {
            opacity: 1;
            transform: translateX(-50%) scale(0.2);
        }
        to {
            opacity: 0;
            transform: translateX(-50%) scale(6);
        }
    }
    @keyframes bang {
        from {
            opacity: 0;
            transform: translate(-50%, -50%) rotate(-30deg) scale(0.2);
        }
        25% {
            opacity: 1;
        }
        80% {
            opacity: 1;
        }
        to {
            opacity: 0;
            transform: translate(-50%, -90%) rotate(-12deg) scale(1.1);
        }
    }
    @keyframes flash {
        from {
            opacity: 0.55;
        }
        to {
            opacity: 0;
        }
    }
    @keyframes dust {
        from {
            opacity: 1;
            transform: translate(-50%, -50%) scale(0.4);
        }
        to {
            opacity: 0;
            transform: translate(-50%, -70%) scale(1.6);
        }
    }
    @keyframes fly {
        from {
            left: var(--x0);
            top: var(--y0);
        }
    }
    @keyframes arc {
        50% {
            transform: translateY(-80%);
        }
    }
    @keyframes spin {
        to {
            rotate: 600deg;
        }
    }
    @keyframes rain {
        from {
            opacity: 1;
            transform: translateY(0) rotate(0);
        }
        to {
            opacity: 1;
            transform: translateY(85cqh) rotate(var(--spin));
        }
    }
    @keyframes zoom {
        40% {
            transform: scale(1.06);
        }
    }
    @keyframes breathe {
        50% {
            transform: scaleY(0.96) translateY(2%);
        }
    }
    @keyframes crouch {
        to {
            transform: scaleY(0.85) scaleX(1.08) translateX(-6%);
        }
    }
    /* Squash into the blow, stretch out of it */
    @keyframes strike {
        25% {
            transform: translateX(26%) rotate(16deg) scale(1.18, 0.9);
        }
        55% {
            transform: translateX(8%) rotate(4deg) scale(0.95, 1.06);
        }
    }
    @keyframes struck {
        0%,
        20% {
            transform: translateX(-18%) rotate(-16deg) scale(1.05, 0.9);
            filter: brightness(3) saturate(0);
        }
        45% {
            transform: translateX(-8%) rotate(-6deg);
            filter: brightness(1.4) sepia(1) hue-rotate(-40deg) saturate(4);
        }
        70% {
            transform: translateX(5%) rotate(4deg);
        }
    }
    @keyframes fall {
        from {
            transform: none;
            filter: brightness(3) saturate(0);
        }
        25% {
            transform: translateY(-20%) rotate(18deg);
        }
    }
    @keyframes cheer {
        50% {
            transform: translateY(-14%) scale(1.06);
        }
    }
    @keyframes mark {
        to {
            transform: scale(1.12);
        }
    }
    @keyframes burst {
        from {
            transform: translate(-50%, -50%) scale(0.3) rotate(0);
            opacity: 1;
        }
        to {
            transform: translate(-50%, -50%) scale(1.3) rotate(20deg);
            opacity: 0;
        }
    }
    @keyframes rise {
        from {
            opacity: 0;
            transform: translate(-50%, 20px) scale(0.6);
        }
        15% {
            opacity: 1;
            transform: translate(-50%, 0) scale(1.25);
        }
        to {
            opacity: 0;
            transform: translate(-50%, -30px);
        }
    }
    @keyframes drop {
        from {
            transform: translate(-50%, -14px) scale(1.2);
            opacity: 0;
        }
    }
    @keyframes shake {
        20% {
            transform: translate(-6px, 3px);
        }
        40% {
            transform: translate(5px, -4px);
        }
        60% {
            transform: translate(-4px, 2px);
        }
        80% {
            transform: translate(3px, -1px);
        }
    }
    @keyframes slam {
        from {
            opacity: 0;
            transform: rotate(-6deg) scale(3);
        }
    }
}

/* Short players: no stats or traits */
@container (max-height: 240px) {
    .stats,
    .trait,
    .backers,
    .mute,
    .entry-backers,
    .face {
        display: none;
    }
    .pit {
        --m: clamp(22px, 30cqh, 70px);
    }
}
@container (max-height: 160px) {
    .frame {
        flex-direction: row;
        flex-wrap: wrap;
    }
    .top {
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        gap: 0;
        width: 120px;
        height: 100%;
        box-sizing: border-box;
        flex-shrink: 0;
    }
    .status {
        white-space: normal;
        font-size: 11px;
        line-height: 1.2;
        max-height: 2.4em;
    }
    .lineup,
    .pit {
        height: 100%;
    }
    .caption {
        font-size: 11px;
    }
    .caption.age-1,
    .caption.age-2 {
        display: none;
    }
    .bottom,
    .board {
        height: 100%;
        box-sizing: border-box;
        width: 26%;
        max-width: 240px;
        flex-direction: column;
        justify-content: center;
        align-items: stretch;
    }
    .board {
        display: flex;
        gap: 2px;
        padding: 4px 8px;
    }
    .entry {
        padding: 0 4px;
    }
    .entry-name {
        font-size: 10px;
    }
    .backing {
        display: none;
    }
    .chips {
        flex-wrap: nowrap;
    }
    .chip {
        flex: 1;
        min-height: 28px;
        padding: 0 4px;
        font-size: 12px;
    }
    .hint {
        white-space: normal;
        font-size: 12px;
    }
}
/* Narrow: the line-up and the scoreboard go two by two */
@container (max-width: 520px) and (min-height: 300px) {
    .lineup,
    .board {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .lineup {
        grid-template-rows: repeat(2, minmax(0, 1fr));
    }
}
</style>
