export const getBlueRedColor = (t: number) => {
    t = Math.max(0, Math.min(1, t));
    let r = 0, g = 0, b = 0;
    if (t < 0.33) {
        const f = t / 0.33; r = 0; g = Math.floor(f * 255); b = 255;
    } else if (t < 0.66) {
        const f = (t - 0.33) / 0.33; r = Math.floor(f * 255); g = 255; b = Math.floor((1 - f) * 255);

    } else {
        const f = (t - 0.66) / 0.34; r = 255; g = Math.floor((1 - f) * 255); b = 0;
    }
    return `rgba(${r}, ${g}, ${b}, 0.6)`;
};
