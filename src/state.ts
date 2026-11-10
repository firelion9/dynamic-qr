export const state = {
    currentData: '',
    selectedStyle: 'animation1',
    selectedStyleName: 'AnimationStyle1',
};

export function styleNumber(): number {
    const match = state.selectedStyle.match(/\d+/);
    return match ? parseInt(match[0], 10) : 1;
}