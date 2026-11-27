/** Durations an item can be rented for, in days */
export const DURATIONS = { day: 1, week: 7, month: 30 } as const;

export type Duration = keyof typeof DURATIONS;

export type ShopOption = { id: string; name: string };

export type ShopItem = {
    name: string;
    pitch: string;
    /** Price in cents per duration it can be rented for. Longer is cheaper per day */
    prices: Partial<Record<Duration, number>>;
    /** What can be picked, free to switch while the rental runs */
    options?: ShopOption[];
};

/** Everyone's name color when they don't rent one */
export const DEFAULT_COLOR = '#aaaaaa';

/** Name colours. The stored value is the hex code */
export const COLORS = [
    // Grays
    { id: 0, name: 'Dark Dark Dark Dark Gray', value: '#656565' },
    { id: 1, name: 'Dark Dark Dark Gray', value: '#757575' },
    { id: 2, name: 'Dark Dark Gray', value: '#858585' },
    { id: 3, name: 'Dark Gray', value: '#959595' },
    { id: 5, name: 'Gray', value: '#bbbbbb' },
    { id: 6, name: 'lightgray', value: '#cccccc' },
    { id: 7, name: 'Light Gray', value: '#dddddd' },
    { id: 8, name: 'Light Light Gray', value: '#eeeeee' },
    { id: 9, name: 'Light Light Light Gray', value: '#f6f6f6' },

    // https://coolors.co/ff4769-f7457c-f34486-ee428f-e640a2-dd3db4-d53bc7-cc38da-c837e4-c436ed
    { id: 10, name: 'Fiery Rose', value: '#FF4769' },
    { id: 11, name: 'Light French Rose', value: '#F7457C' },
    { id: 12, name: 'French Rose', value: '#F34486' },
    { id: 13, name: 'French Fuchsia', value: '#EE428F' },
    { id: 14, name: 'Light Frostbite', value: '#E640A2' },
    { id: 15, name: 'Frostbite', value: '#DD3DB4' },
    { id: 16, name: 'Light Light Steel Pink', value: '#D53BC7' },
    { id: 17, name: 'Steel Pink', value: '#CC38DA' },
    { id: 18, name: 'Steel Pink', value: '#C837E4' },
    { id: 19, name: 'Phlox', value: '#C436ED' },

    // https://coolors.co/bb33ff-bc47ff-b65cff-a35cff-7e47ff-5447ff-4778ff-4788ff-5c9aff-70b5ff
    { id: 20, name: 'Electric Purple', value: '#BB33FF' },
    { id: 21, name: 'Phlox Purple', value: '#BC47FF' },
    { id: 22, name: 'Medium Orchid', value: '#B65CFF' },
    { id: 23, name: 'Medium Purple', value: '#A35CFF' },
    { id: 24, name: 'Majorelle Purple', value: '#7E47FF' },
    { id: 25, name: 'Majorelle Blue', value: '#5447FF' },
    { id: 26, name: 'Blue Crayola', value: '#4778FF' },
    { id: 27, name: 'United Nations Blue', value: '#4788FF' },
    { id: 28, name: 'Cornflower Blue', value: '#5C9AFF' },
    { id: 29, name: 'French Sky Blue', value: '#70B5FF' },

    // https://coolors.co/70b5ff-6cbff1-67c8e3-62d1d5-5ddac6-58e4b8-53eda9-4ef69b-4cfb94-49ff8c
    { id: 31, name: 'Maya blue', value: '#6CBFF1' },
    { id: 32, name: 'Sky blue', value: '#67C8E3' },
    { id: 33, name: 'Robin egg blue', value: '#62D1D5' },
    { id: 34, name: 'Turquoise', value: '#5DDAC6' },
    { id: 35, name: 'Aquamarine', value: '#58E4B8' },
    { id: 36, name: 'Aquamarine 2', value: '#53EDA9' },
    { id: 37, name: 'Spring green', value: '#4EF69B' },
    { id: 38, name: 'Sprint green 2', value: '#4CFB94' },
    { id: 39, name: 'Spring green 3', value: '#49FF8C' },
];

/** Longest title, in characters */
export const TITLE_MAX_LENGTH = 16;

/** Everything for sale. Rented items are stored on the user under their key, and when they end under `<key>Until`, in ms */
export const SHOP = {
    color: {
        name: 'Name color',
        pitch: 'Your name and avatar border, in the color you pick.',
        prices: { week: 750 * 100, month: 2000 * 100 },
        options: COLORS.map((color) => ({ id: String(color.id), name: color.name })),
    },
    effect: {
        name: 'Animated name',
        pitch: 'Your name in motion, everywhere it shows.',
        prices: { day: 400 * 100, week: 2000 * 100 },
        options: [
            { id: 'shimmer', name: 'Shimmer' },
            { id: 'rainbow', name: 'Rainbow' },
            { id: 'fire', name: 'Fire' },
            { id: 'ice', name: 'Ice' },
            { id: 'gold', name: 'Gold' },
        ],
    },
    frame: {
        name: 'Avatar frame',
        pitch: 'A glowing frame around your avatar, in the list and next to your messages.',
        prices: { week: 1000 * 100, month: 2700 * 100 },
        options: [
            { id: 'gold', name: 'Gold' },
            { id: 'neon', name: 'Neon' },
            { id: 'fire', name: 'Fire' },
            { id: 'ice', name: 'Ice' },
            { id: 'rainbow', name: 'Rainbow' },
        ],
    },
    title: {
        name: 'Title',
        pitch: `A few words of your own next to your name, up to ${TITLE_MAX_LENGTH} characters.`,
        prices: { week: 500 * 100, month: 1350 * 100 },
    },
    shield: {
        name: 'Shield',
        pitch: 'Wizz, sandale and confuse bounce off you, and nobody pays for them.',
        prices: { day: 300 * 100, week: 1500 * 100 },
    },
} satisfies Record<string, ShopItem>;

export type ShopSlot = keyof typeof SHOP;
