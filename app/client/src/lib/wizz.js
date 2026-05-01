const WIZZ_AUDIO_SRC = '/audio/wizz.mp3';
const WIZZ_DURATION_MS = 1000;

let audio = null;

function getAudio() {
    if (!audio) {
        audio = new Audio(WIZZ_AUDIO_SRC);
    }
    return audio;
}

export function triggerWizz() {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion) {
        document.body.classList.remove('wizz-shake');
        // Force reflow so re-adding the class restarts the animation
        void document.body.offsetWidth;
        document.body.classList.add('wizz-shake');
        setTimeout(() => document.body.classList.remove('wizz-shake'), WIZZ_DURATION_MS);
    }

    const a = getAudio();
    a.currentTime = 0;
    a.play().catch(() => {});

    navigator.vibrate?.([200, 100, 200]);
}
