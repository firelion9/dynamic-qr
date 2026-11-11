import { AllAnimations } from './registry';
import type { QrAnimation } from './utils';

export interface CatalogEntry {
    key: string;
    title: string;
    description: string;
    themed: boolean;
    animation: QrAnimation<any>;
}

const INFO: [string, string, string][] = [
    ['snake', 'Змейка', 'Ползает по коду за яблоками. Модули под ней перекрашиваются, пока хватает запаса коррекции ошибок.'],
    ['snake-duel', 'Дуэль', 'Две змейки охотятся за одними яблоками и не дают друг другу пройти.'],
    ['maze', 'Лабиринт', 'Тёмные модули становятся коридорами. Пожиратель собирает точки и убегает от глитчей.'],
    ['maze-night', 'Ночной лабиринт', 'Тот же лабиринт на чёрном фоне. Код инвертирован, поэтому его читают не все сканеры.'],
    ['flipping', 'Мерцание', 'Случайные модули на мгновение меняют цвет.'],
    ['static', 'Статика', 'Обычный QR без анимации, для сравнения.'],
    ['breath', 'Дыхание', 'Вы знали, что модули QR-кода - это живые существа?'],
    ['waves', 'Волны', 'Волны'],
];

export const CATALOG: CatalogEntry[] = INFO.filter(([key]) => AllAnimations.has(key)).map(([key, title, description]) => ({
    key,
    title,
    description,
    themed: key.startsWith('snake') || key.startsWith('maze'),
    animation: AllAnimations.get(key)!,
}));

export function catalogEntry(key: string): CatalogEntry {
    return CATALOG.find(entry => entry.key === key) ?? CATALOG[0];
}
