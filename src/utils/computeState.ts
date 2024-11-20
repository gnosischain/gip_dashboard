import { GIP } from "../App";

export const computeState = (
    scores: number[],
    quorum: number,
    scores_state: string
) => {
    if (scores_state !== 'final') return '';
    if (!scores || scores.length < 3) return 'invalid';

    const [firstScore, ...otherScores] = scores;
    const isHighest = otherScores.every((score) => firstScore > score);
    const meetsQuorum = firstScore > quorum;
    return isHighest && meetsQuorum ? 'passed' : 'failed';
};

export const computeStatuses = (gips: GIP[]) => {
    let passed = 0;
    let failed = 0;
    let open = 0;

    gips.forEach((gip) => {
        const state = computeState(gip.scores, gip.quorum, gip.scores_state);
        if (state === 'passed') passed++;
        else if (state === 'failed') failed++;
        else open++;
    });

    return [passed, failed, open];
};