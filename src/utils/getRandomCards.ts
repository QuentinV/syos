export const getRandomCards = (
    cards: number[],
    limit: number,
    exclude?: number[]
) => {
    const result: number[] = [];
    let i = 0;
    while (i < limit) {
        const r = Math.floor(Math.random() * cards.length);
        const n = cards[r];
        if (!result.includes(n) && !exclude?.includes(n)) {
            result.push(n);
            ++i;
        }
    }
    return result;
};
