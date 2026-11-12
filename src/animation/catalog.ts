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
    ['train', 'Поезд', 'Поезд-змейка с настраиваемой надписью.'],
    ['flame', 'Пламя', 'Случайные пиксели загораются и распространяют пламя. Обгорев, пиксель-уголёк через некоторое время снова становится белым.'],
    ['flood', 'Потоп', 'Жидкость стекает сверху на QR, при достаточном количестве воды над чёрным пикселем — он может быть смыт. Физика навеяна игрой Noita.'],
    ['life', 'Game of Life', 'Некоторые участки кода живут по правилам игры Game of Life.'],
    ['flipping', 'Мерцание', 'Случайные модули на мгновение меняют цвет.'],
    ['waves', 'Волны', 'Кто-то засунул QR-код в мой коктейль.'],
    ['wave', 'Бит', 'Для ценителей музыки.'],
    ['breath', 'Дыхание', 'Вы знали, что модули QR-кода - это живые существа?'],
    ['matrix', 'Матрица', 'Цифры в тёмных модулях медленно меняются, сверху бегут струи цифрового дождя.'],
    ['static', 'Статика', 'Обычный QR без анимации, для сравнения.'],
];

export const CATALOG: CatalogEntry[] = INFO.filter(([key]) => AllAnimations.has(key)).map(([key, title, description]) => ({
    key,
    title,
    description,
    themed: key !== 'static',
    animation: AllAnimations.get(key)!,
}));

export function catalogEntry(key: string): CatalogEntry {
    return CATALOG.find(entry => entry.key === key) ?? CATALOG[0];
}
