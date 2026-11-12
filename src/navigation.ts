export type ScreenKey = 1 | 2 | 3;

export const screens: Record<ScreenKey, HTMLElement> = {
    1: document.getElementById('screen1') as HTMLElement,
    2: document.getElementById('screen2') as HTMLElement,
    3: document.getElementById('screen3') as HTMLElement,
};

// Every screen is a history entry, so browser Back, Alt+← and the in-app back buttons agree.
export function showScreen(num: ScreenKey, push = true): void {
    if (push) history.pushState({ screen: num }, '');
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[num].classList.add('active');
    document.querySelectorAll('[data-home]').forEach(btn => {
        (btn as HTMLElement).style.display = num === 1 ? 'none' : 'flex';
    });
}

export function screenActive(num: ScreenKey): boolean {
    return screens[num].classList.contains('active');
}

export function goBack(): void {
    if ((history.state?.screen ?? 1) > 1) history.back();
}
