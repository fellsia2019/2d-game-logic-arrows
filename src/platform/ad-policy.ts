export interface AdState {
  available: boolean; victories: number; activeMs: number; lastInterstitialAt: number;
  lastAdAttemptAt: number; nextTeaching: boolean;
}
export function interstitialDue(state: AdState): boolean {
  return state.available && !state.nextTeaching &&
    state.victories >= (state.lastInterstitialAt ? 3 : 5) &&
    state.activeMs - state.lastInterstitialAt >= 180000 &&
    state.activeMs - state.lastAdAttemptAt >= 60000;
}
