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

<style scoped src="./MonkeyFight.css"></style>
