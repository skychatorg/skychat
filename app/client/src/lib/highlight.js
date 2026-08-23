// Regex metacharacters to escape so configured words are matched literally when built into the word regexp
const REGEXP_ESCAPE = /[.*+?^${}()|[\]\\]/g;

/**
 * Walks text nodes only, so words inside tags or attributes never match
 * @param {string} html Formatted message HTML
 * @param {Record<string, string> | null} highlights Word (lowercase) to sticker code
 */
export function wrapHighlights(html, highlights) {
    const words = highlights ? Object.keys(highlights) : [];
    if (!html || words.length === 0) {
        return html;
    }

    const escapedWords = words.map((word) => word.replace(REGEXP_ESCAPE, '\\$&')).join('|');
    const wordRegExp = new RegExp(`(?<![\\p{L}\\p{N}])(${escapedWords})(?![\\p{L}\\p{N}])`, 'giu');

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
    }

    for (const node of textNodes) {
        // Links and buttons keep their own semantics and hover behavior
        if (node.parentNode.closest('a, button')) {
            continue;
        }
        // With a single capture group, split() keeps the matched words at odd indices
        const parts = node.nodeValue.split(wordRegExp);
        if (parts.length < 2) {
            continue;
        }
        const fragment = doc.createDocumentFragment();
        for (let i = 0; i < parts.length; ++i) {
            if (i % 2 === 0) {
                if (parts[i]) {
                    fragment.appendChild(doc.createTextNode(parts[i]));
                }
            } else {
                const span = doc.createElement('span');
                span.className = 'skychat-highlight';
                span.dataset.sticker = highlights[parts[i].toLowerCase()];
                span.textContent = parts[i];
                fragment.appendChild(span);
            }
        }
        node.parentNode.replaceChild(fragment, node);
    }

    return doc.body.innerHTML;
}
