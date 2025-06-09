export const getRandomCards = (
    cards: number[],
    limit: number,
    exclude?: number[]
) => {
    const result = [];
    let i = 0;
    while (i < limit) {
        const n = cards[Math.floor(Math.random() * cards.length)];
        if (!exclude?.includes(n)) {
            result.push(n);
            ++i;
        }
    }
    return result;
};
