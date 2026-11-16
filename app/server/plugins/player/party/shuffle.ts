/**
 * Fisher-Yates, in place, with the game's own random so tests can script it
 */
export function shuffle<T>(list: T[], random: (max: number) => number): T[] {
    for (let i = list.length - 1; i > 0; i--) {
        const j = random(i + 1);
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
}
