import { playCasinoSound, unlockCasinoSound } from '@/lib/casinoSounds';
import { onMounted, onUnmounted, watch } from 'vue';

const visibleCards = (table) =>
    table.dealer.cards.filter(Boolean).length + table.seats.reduce((count, seat) => count + seat.cards.length, 0);

/**
 * Sounds for what changes at the table. Only changes make sound, never the state found on mount,
 * so joining mid-hand, a reconnection or a resize stays quiet
 */
export function useCasinoSounds({ table, myId, myTurn, secondsLeft, enabled, dealStaggerMs }) {
    watch(table, (now, before) => {
        if (!enabled.value || !now || !before || now.channelId !== before.channelId) {
            return;
        }
        const sameHand = now.handId === before.handId;

        if (now.seats.length > (sameHand ? before.seats.length : 0)) {
            playCasinoSound('chip');
        }

        const newCards = visibleCards(now) - (sameHand ? visibleCards(before) : 0);
        const holeRevealed = sameHand && before.dealer.cards.includes(null) && !now.dealer.cards.includes(null);
        if (holeRevealed) {
            playCasinoSound('flip');
        }
        for (let i = holeRevealed ? 1 : 0; i < newCards; i++) {
            playCasinoSound('deal', i * dealStaggerMs);
        }

        const mine = now.seats.find((seat) => seat.user.id === myId.value);
        const wasSettled = sameHand && before.seats.find((seat) => seat.user.id === myId.value)?.outcome;
        if (mine?.outcome && !wasSettled) {
            playCasinoSound({ blackjack: 'blackjack', win: 'win', push: 'push' }[mine.outcome] ?? 'lose', 300);
        }
    });

    watch(secondsLeft, (seconds) => {
        if (enabled.value && myTurn.value && seconds > 0 && seconds <= 5) {
            playCasinoSound('tick');
        }
    });

    onMounted(() => window.addEventListener('pointerdown', unlockCasinoSound, { once: true }));
    onUnmounted(() => window.removeEventListener('pointerdown', unlockCasinoSound));
}
