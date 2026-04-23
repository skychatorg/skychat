const norm = (s) =>
    (s || '')
        .toString()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();

const WORD_BOUNDARY = /[\s\-_/.,:]/;

/**
 * Score a candidate string against the query.
 * Returns a positive number for a match, 0 for no match.
 */
function scoreString(candidate, query) {
    if (!candidate) return 0;
    if (!query) return 0;

    // Exact substring — by far the strongest signal.
    const exactIndex = candidate.indexOf(query);
    if (exactIndex !== -1) {
        // Earlier match and whole-word boundary matches rank higher.
        let bonus = 1000 - exactIndex;
        if (exactIndex === 0) bonus += 200;
        else if (WORD_BOUNDARY.test(candidate[exactIndex - 1])) bonus += 100;
        return bonus;
    }

    // Subsequence — every query char appears in order.
    let score = 0;
    let qi = 0;
    let lastMatchIndex = -1;
    let consecutive = 0;
    for (let ci = 0; ci < candidate.length && qi < query.length; ci++) {
        if (candidate[ci] === query[qi]) {
            if (ci === lastMatchIndex + 1) {
                consecutive += 1;
                score += 5 + consecutive * 2;
            } else {
                consecutive = 0;
                score += 1;
            }
            if (ci === 0 || WORD_BOUNDARY.test(candidate[ci - 1])) {
                score += 8;
            }
            lastMatchIndex = ci;
            qi += 1;
        }
    }
    return qi === query.length ? score : 0;
}

/**
 * @param {import('./types.js').Command[]} commands
 * @param {string} rawQuery
 * @returns {import('./types.js').Command[]}
 */
export function scoreCommands(commands, rawQuery) {
    const query = norm(rawQuery).trim();
    if (!query) return commands.slice();

    const scored = [];
    for (const cmd of commands) {
        const titleScore = scoreString(norm(cmd.title), query) * 3;
        let kwScore = 0;
        if (cmd.keywords) {
            for (const kw of cmd.keywords) {
                const s = scoreString(norm(kw), query);
                if (s > kwScore) kwScore = s;
            }
            kwScore *= 1.5;
        }
        const subScore = scoreString(norm(cmd.subtitle), query);
        const catScore = scoreString(norm(cmd.category), query) * 0.5;
        const total = titleScore + kwScore + subScore + catScore;
        if (total > 0) {
            scored.push({ cmd, total, titleLen: cmd.title.length });
        }
    }
    scored.sort((a, b) => b.total - a.total || a.titleLen - b.titleLen);
    return scored.map((x) => x.cmd);
}
