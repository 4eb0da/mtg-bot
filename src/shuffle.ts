export function shuffle<T>(arr: T[]): T[] {
    const len = arr.length;

    for (let i = 0; i < len; ++i) {
        const rnd = Math.floor((len - i) * Math.random());

        const temp = arr[i];
        arr[i] = arr[i + rnd];
        arr[i + rnd] = temp;
    }

    return arr;
}
