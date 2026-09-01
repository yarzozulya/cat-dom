// ============================================================
//  МЕНЮ  —  три задания на сегодня
// ============================================================

import Phaser from 'phaser';
import { FIELD } from '../config/level.js';
import { load } from '../core/save.js';
import { tasksForToday } from '../config/tasks.js';
import { makeTextures } from '../core/greybox.js';

export default class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    this.cameras.main.setBackgroundColor('#56504B');
    makeTextures(this);
    const saved = load();
    const tasks = tasksForToday(saved.day);

    this.add.text(FIELD.w / 2, 110, 'КОТ', {
      fontFamily: 'sans-serif', fontSize: '52px', color: '#E8A33D', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(FIELD.w / 2, 168, 'три задания на сегодня', {
      fontFamily: 'sans-serif', fontSize: '17px', color: '#C4B8B0'
    }).setOrigin(0.5);

    this.add.text(FIELD.w / 2, 216, 'Рыбки  ' + saved.fish, {
      fontFamily: 'sans-serif', fontSize: '24px', color: '#5FA9BB'
    }).setOrigin(0.5);

    tasks.forEach((t, i) => {
      const y = 330 + i * 140;
      const done = saved.tasksDoneToday.includes(t.id);

      const box = this.add.rectangle(FIELD.w / 2, y, FIELD.w - 60, 112,
        done ? 0x413B37 : 0x332D2A)
        .setStrokeStyle(1, done ? 0x372B44 : 0xE8A33D, done ? 1 : 0.6);

      this.add.text(52, y - 36, t.title, {
        fontFamily: 'sans-serif', fontSize: '22px',
        color: done ? '#8D827B' : '#ffffff', fontStyle: 'bold'
      });
      this.add.text(52, y - 4, t.hint, {
        fontFamily: 'sans-serif', fontSize: '15px',
        color: done ? '#6E635C' : '#C4B8B0', fontStyle: 'italic',
        wordWrap: { width: FIELD.w - 130 }
      });
      this.add.text(52, y + 34, done ? 'выполнено' : 'нажми, чтобы начать', {
        fontFamily: 'sans-serif', fontSize: '14px',
        color: done ? '#8CB86E' : '#F0B44E'
      });

      if (!done) {
        box.setInteractive({ useHandCursor: true });
        box.on('pointerup', () => this.scene.start('Level', { task: t }));
      }
    });

    const allDone = tasks.every(t => saved.tasksDoneToday.includes(t.id));
    this.add.text(FIELD.w / 2, FIELD.h - 90,
      allDone ? 'На сегодня всё. Кот доволен. Наверное.'
              : 'Заходы не ограничены. Награда за задание — один раз.', {
      fontFamily: 'sans-serif', fontSize: '15px', color: '#9A8F87',
      align: 'center', wordWrap: { width: FIELD.w - 80 }
    }).setOrigin(0.5);
  }
}
