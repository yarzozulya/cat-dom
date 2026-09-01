// ============================================================
//  РЕЕСТР АССЕТОВ  —  единственный договор между кодом и графикой
// ============================================================
//
//  Игровое поле: 540 × 960 — это ровно половина от 1080 × 1920,
//  то есть соотношение сторон телефона 9:16.
//  Художник рисует в двойном размере (×2) и кладёт как есть —
//  на экране всё сядет пиксель в пиксель.
//
//  Для каждого объекта здесь записано:
//    file   — имя картинки в папке public/art/
//    w, h   — размер в игровых пикселях (умножить на 2 для файла)
//    color  — цвет заглушки, пока картинки нет
//    shape  — форма заглушки: rect | cat | human | fish | table | lamp
//    label  — подпись на заглушке
//
//  Размеры заданы относительно кота: кот 56 × 38.
//  Всё остальное — в правдоподобной пропорции к нему.
// ============================================================

export const ART_DIR = 'art/';

export const ASSETS = {
  // ---- персонаж ----
  cat:      { file: 'cat.png',      w: 56,  h: 38,  color: 0xE8A33D, shape: 'cat',   label: '' },

  // ---- поверхности, на которые кот приземляется ----
  tumba:    { file: 'tumba.png',    w: 70,  h: 56,  color: 0x8B5E3C, shape: 'rect',  label: 'Тумбочка' },
  lampa:    { file: 'lampa.png',    w: 32,  h: 50,  color: 0xC9A227, shape: 'lamp',  label: '' },
  krovat:   { file: 'krovat.png',   w: 250, h: 60,  color: 0x9C4A63, shape: 'rect',  label: 'Кровать' },
  komod:    { file: 'komod.png',    w: 84,  h: 130, color: 0x5A4433, shape: 'tv',    label: 'Комод и ТВ' },
  stol:     { file: 'stol.png',     w: 130, h: 82,  color: 0x6B4A2F, shape: 'round', label: 'Стол' },
  shkaf:    { file: 'shkaf.png',    w: 150, h: 130, color: 0x4A3B2A, shape: 'shkaf', label: 'Шкаф' },

  // ---- декор и опасности ----
  okno:     { file: 'okno.png',     w: 34,  h: 150, color: 0x3C6E8F, shape: 'rect',  label: 'Окно' },
  hozyain:  { file: 'hozyain.png',  w: 200, h: 48,  color: 0xD8A48F, shape: 'human', label: '' },

  // ---- прочее ----
  ryba:     { file: 'ryba.png',     w: 30,  h: 22,  color: 0x5FA9BB, shape: 'fish',  label: '' },
  podushka: { file: 'podushka.png', w: 46,  h: 30,  color: 0xE7E2EC, shape: 'pillow',label: '' },

  // Пол. Кот может прыгать по нему сколько угодно — это не провал.
  pol:      { file: 'pol.png',      w: 540, h: 78,  color: 0x2E5233, shape: 'rect',  label: '' }
};

// Ключи, для которых картинка уже нарисована и лежит в public/art/.
// Художник дописывает сюда ключ — и заглушка сама заменяется картинкой.
export const READY = [
  // 'cat',
  // 'krovat',
];
