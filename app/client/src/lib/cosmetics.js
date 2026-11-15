/**
 * Class and style for a user's name: their color, under the animated effect they rent if any
 */
export function nameStyle(user) {
    const custom = user?.data?.plugins?.custom ?? {};
    return {
        class: custom.effect ? ['name-fx', `name-fx-${custom.effect}`] : [],
        style: { color: custom.color, '--name-color': custom.color },
    };
}

/**
 * Class and style for a user's avatar border: their color, or the frame they rent
 */
export function avatarStyle(user) {
    const custom = user?.data?.plugins?.custom ?? {};
    return {
        class: custom.frame ? ['avatar-frame', `frame-${custom.frame}`] : [],
        style: { borderColor: custom.frame ? undefined : custom.color, '--name-color': custom.color },
    };
}
