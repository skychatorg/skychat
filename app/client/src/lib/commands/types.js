/**
 * @typedef {'Rooms' | 'Users' | 'Player' | 'Chat' | 'Settings' | 'Session' | 'Navigation'} CommandCategory
 *
 * @typedef {Object} Command
 * @property {string} id                 Stable unique id (e.g. 'room.join.42')
 * @property {string} title              Main label
 * @property {string} [subtitle]         Secondary text shown in muted color
 * @property {string} [icon]             Font Awesome icon name (without the 'fa-' prefix)
 * @property {CommandCategory} category  Group header
 * @property {string[]} [keywords]       Extra terms the fuzzy matcher considers
 * @property {string} [shortcut]         Display-only hint (e.g. 'Alt+↓')
 *
 * Exactly one of `run` / `expand` must be set.
 * @property {() => void} [run]           Atomic action (closes the palette after firing)
 * @property {() => ExpandResult} [expand]  Two-step entry (pushes a frame)
 *
 * @typedef {ListFrame | PromptFrame} ExpandResult
 *
 * @typedef {Object} ListFrame
 * @property {'list'} type
 * @property {string} title
 * @property {Command[]} commands
 *
 * @typedef {Object} PromptFrame
 * @property {'prompt'} type
 * @property {string} title
 * @property {string} [placeholder]
 * @property {(value: string) => void} run
 */

export {};
