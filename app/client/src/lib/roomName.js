/**
 * Display name of a room. Private rooms have no name of their own: they are shown as the list of
 * their other participants.
 */
export function roomName(room, ownUsername) {
    if (!room) {
        return '';
    }
    if (!room.isPrivate || room.name) {
        return room.name;
    }
    const others = (room.whitelist ?? []).filter((identifier) => identifier !== ownUsername?.toLowerCase());
    if (others.length === 0) {
        return 'Just you';
    }
    return `@${others.join(', @')}`;
}
