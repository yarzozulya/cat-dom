// ============================================================
//  СЦЕНА УРОВНЯ  —  кот прыгает по комнате
// ============================================================
//  Здесь только поведение. Все данные — в config/, все числа — в balance.js.
//
//  Главное правило физики: мебель НЕ препятствие, а площадка.
//  Кот пролетает сквозь неё снизу и сбоку и приземляется только сверху.
//  Головой ни обо что не бьётся — предметы просто выше на экране.
// ============================================================

import Phaser from 'phaser';
import { FIELD, FLOOR_Y, FURNITURE, HAZARDS, STASH_POOL } from '../config/level.js';
import { buildLayout } from '../config/layout.js';
import { BALANCE } from '../config/balance.js';
import { preloadArt, makeTextures, labelFor, sizeOf } from '../core/greybox.js';
import { load, save, addFish, markTaskDone } from '../core/save.js';

export default class LevelScene extends Phaser.Scene {
  constructor() { super('Level'); }

  init(data) {
    this.task = data.task;
    this.jumps = 0;
    this.runFish = 0;
    this.visited = [];
    this.state = 'idle';
    this.dragStart = null;
    this.ownerArmed = false;
    this.standingOn = null;
    this.fallen = {};          // что уже упало: lampa, tv
  }

  preload() { preloadArt(this); }

  create() {
    // ---------- фон ----------
    this.cameras.main.setBackgroundColor('#56504B');

    makeTextures(this);

    // Раскладка комнаты собирается заново при каждом заходе:
    // кровать с комодом могут поменяться сторонами, стол и шкаф
    // сдвигаются, вся комната иногда отражается зеркально.
    const layout = buildLayout(FURNITURE, STASH_POOL);
    this.items = layout.items;

    // ---------- пол ----------
    // Занимает весь низ. Приземление сюда — не провал: кот просто внизу
    // и может прыгать отсюда сколько угодно.
    const ps = sizeOf('pol');
    this.add.image(FIELD.w / 2, FLOOR_Y + ps.h / 2, 'pol').setAlpha(0.85).setDepth(1);
    this.floorGroup = this.physics.add.staticGroup();
    this.floorGroup.create(FIELD.w / 2, FLOOR_Y + ps.h / 2, 'pol').refreshBody().setVisible(false);

    // ---------- окно ----------
    const okno = { ...HAZARDS.okno };
    if (layout.mirrored) okno.x = FIELD.w - okno.x;
    const os = sizeOf('okno');
    this.add.image(okno.x, okno.y, 'okno').setAlpha(0.75).setDepth(1);
    labelFor(this, 'okno', okno.x, okno.y);
    this.windowRect = new Phaser.Geom.Rectangle(
      okno.x - os.w / 2, okno.y - os.h / 2, os.w, os.h
    );

    // ---------- мебель ----------
    this.platforms = this.physics.add.staticGroup();
    this.items.forEach(item => {
      const body = this.platforms.create(item.x, item.y, item.id).refreshBody();
      body.setData('item', item);
      body.setDepth(2);
      // Односторонняя площадка: реагирует только на касание сверху
      body.body.checkCollision.down = false;
      body.body.checkCollision.left = false;
      body.body.checkCollision.right = false;
      labelFor(this, item.id, item.x, item.y);

      if (item.lamp) {
        const ls = sizeOf('lampa'), is = sizeOf(item.id);
        this.lampa = this.add.image(item.x, item.y - is.h / 2 - ls.h / 2, 'lampa').setDepth(4);
      }
      if (item.fragile === 'tv') {
        this.komodItem = item;
      }

      if (item.id === this.task.goal) {
        const y = item.y - sizeOf(item.id).h / 2 - 20;
        this.goalMarker = this.add.text(item.x, y, '▼', {
          fontFamily: 'sans-serif', fontSize: '20px', color: '#F0B44E'
        }).setOrigin(0.5, 1).setDepth(6);
        this.tweens.add({
          targets: this.goalMarker, y: y - 7,
          duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
      }

      if (item.hasOwner) {
        const hs = sizeOf('hozyain'), is = sizeOf(item.id);
        this.ownerHome = item.y - is.h / 2 - hs.h / 2 + 6;
        this.owner = this.add.image(item.x, this.ownerHome, 'hozyain').setDepth(3);
        this.ownerRect = new Phaser.Geom.Rectangle(
          item.x - hs.w / 2, item.y - is.h / 2 - hs.h - 24, hs.w, hs.h + 34
        );
      }
    });

    // ---------- заначки ----------
    const saved = load();
    this.stashSprites = [];
    layout.stash.forEach((s, i) => {
      if (saved.stashTaken.includes(i)) return;
      const sp = this.add.image(s.x, s.y, 'ryba').setDepth(4);
      sp.setData('index', i).setData('fish', s.fish);
      this.tweens.add({
        targets: sp, y: s.y - 8, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
      this.stashSprites.push(sp);
    });

    // ---------- кот ----------
    this.cat = this.physics.add.sprite(100, FLOOR_Y - sizeOf('cat').h / 2, 'cat').setDepth(5);
    this.cat.body.allowGravity = false;

    this.physics.add.collider(this.cat, this.floorGroup, () => this.land(null, 'pol'));

    // Односторонние площадки: коллизия только если кот падает вниз
    // и его лапы ещё выше верхней грани предмета.
    this.physics.add.collider(
      this.cat, this.platforms,
      (cat, body) => this.land(body.getData('item'), 'platform', body),
      (cat, body) => {
        if (cat.body.velocity.y < 0) return false;           // летит вверх — пролетает насквозь
        const prevBottom = cat.body.prev.y + cat.body.height; // где были лапы в прошлом кадре
        return prevBottom <= body.body.top + 8;              // были выше — значит приземляется
      }
    );

    // Ограничиваем скорость падения, чтобы кот физически не мог
    // проскочить площадку между двумя кадрами.
    this.cat.body.setMaxVelocityY(1400);

    this.buildHud();

    this.aim = this.add.graphics().setDepth(7);
    this.input.on('pointerdown', p => this.onDown(p));
    this.input.on('pointermove', p => this.onMove(p));
    this.input.on('pointerup',   p => this.onUp(p));

    this.say('Тяни кота и отпускай.');
  }

  // ============================================================
  //  ИНТЕРФЕЙС
  // ============================================================
  buildHud() {
    this.add.rectangle(FIELD.w / 2, 46, FIELD.w, 92, 0x241C29, 0.9)
      .setOrigin(0.5).setDepth(9);

    const d = 10;
    this.add.text(16, 12, 'ЗАДАНИЕ', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#9C90A5'
    }).setDepth(d);
    this.add.text(16, 28, this.task.title, {
      fontFamily: 'sans-serif', fontSize: '19px', color: '#ffffff', fontStyle: 'bold'
    }).setDepth(d);
    this.add.text(16, 55, this.task.hint, {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#A497AC', fontStyle: 'italic'
    }).setDepth(d);

    this.fishText = this.add.text(FIELD.w - 16, 16, 'Рыбки  0', {
      fontFamily: 'sans-serif', fontSize: '15px', color: '#7FC6D8'
    }).setOrigin(1, 0).setDepth(d);
    this.jumpText = this.add.text(FIELD.w - 16, 38, 'Прыжки  0', {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#9C90A5'
    }).setOrigin(1, 0).setDepth(d);

    const back = this.add.text(FIELD.w - 16, 62, '× к заданиям', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#8D8195'
    }).setOrigin(1, 0).setDepth(d).setInteractive({ useHandCursor: true });
    back.on('pointerup', () => this.scene.start('Menu'));

    // Облачко реплики — живёт рядом с котом, а не наверху экрана
    this.bubbleBg = this.add.rectangle(0, 0, 10, 10, 0x241C29, 0.94)
      .setOrigin(0.5).setAlpha(0).setDepth(14);
    this.bubbleTx = this.add.text(0, 0, '', {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#F5EDEF',
      align: 'center', wordWrap: { width: 210 }
    }).setOrigin(0.5).setAlpha(0).setDepth(15);
  }

  // Показывает реплику над котом (или под ним, если кот у верхнего края)
  say(text) {
    this.bubbleTx.setText(text);
    const w = this.bubbleTx.width + 22;
    const h = this.bubbleTx.height + 14;
    this.bubbleBg.setSize(w, h);
    this.placeBubble();
    this.tweens.killTweensOf([this.bubbleTx, this.bubbleBg]);
    this.bubbleTx.setAlpha(1);
    this.bubbleBg.setAlpha(0.94);
    this.tweens.add({
      targets: [this.bubbleTx, this.bubbleBg], alpha: 0, delay: 2300, duration: 400
    });
  }

  placeBubble() {
    const h = this.bubbleBg.height, w = this.bubbleBg.width;
    const above = this.cat.y - sizeOf('cat').h / 2 - h / 2 - 10;
    const y = above < 150 ? this.cat.y + sizeOf('cat').h / 2 + h / 2 + 10 : above;
    const x = Phaser.Math.Clamp(this.cat.x, w / 2 + 10, FIELD.w - w / 2 - 10);
    this.bubbleBg.setPosition(x, y);
    this.bubbleTx.setPosition(x, y);
  }

  updateHud() {
    this.fishText.setText('Рыбки  ' + this.runFish);
    this.jumpText.setText('Прыжки  ' + this.jumps);
  }

  // ============================================================
  //  УПРАВЛЕНИЕ
  // ============================================================
  canAct() {
    return this.state === 'idle' || this.state === 'landed';
  }

  onDown(p) {
    if (!this.canAct()) return;
    if (p.y < 100) return;                 // не перехватываем нажатия по шапке
    // Тянуть можно из ЛЮБОЙ точки экрана — целиться по коту не нужно.
    // Короткое нажатие без движения останется командой «иди туда».
    this.dragStart = { x: p.x, y: p.y };
    this.stateBeforeAim = this.state;
    this.state = 'aiming';
  }

  onMove(p) {
    if (this.state !== 'aiming' || !this.dragStart) return;
    const v = this.dragVector(p);
    this.aim.clear();
    if (v.dist < BALANCE.MIN_DRAG) return;
    const vx = Math.cos(v.angle) * v.dist * BALANCE.LAUNCH_POWER;
    const vy = Math.sin(v.angle) * v.dist * BALANCE.LAUNCH_POWER;
    for (let i = 1; i <= BALANCE.AIM_DOTS; i++) {
      const t = i * BALANCE.AIM_STEP;
      const x = this.cat.x + vx * t;
      const y = this.cat.y + vy * t + 0.5 * BALANCE.GRAVITY * t * t;
      if (y > FIELD.h || x < -20 || x > FIELD.w + 20) break;
      const k = 1 - i / (BALANCE.AIM_DOTS + 3);
      this.aim.fillStyle(0xF0B44E, 0.18 + 0.55 * k);
      this.aim.fillCircle(x, y, 2 + 2.6 * k);
    }
  }

  onUp(p) {
    if (this.state !== 'aiming' || !this.dragStart) return;
    this.aim.clear();
    const v = this.dragVector(p);
    this.dragStart = null;
    if (v.dist < BALANCE.MIN_DRAG) {
      // это был тап, а не оттяжка — отправляем кота идти
      this.state = this.stateBeforeAim || (this.standingOn ? 'landed' : 'idle');
      let left, right;
      if (this.standingOn) {
        const sz = sizeOf(this.standingOn.id);
        left  = this.standingOn.x - sz.w / 2 + 16;
        right = this.standingOn.x + sz.w / 2 - 16;
      } else {
        left = 20; right = FIELD.w - 20;
      }
      if (Math.abs(p.y - this.cat.y) < 130) this.walkTo(p.x, left, right);
      return;
    }
    this.launch(
      Math.cos(v.angle) * v.dist * BALANCE.LAUNCH_POWER,
      Math.sin(v.angle) * v.dist * BALANCE.LAUNCH_POWER,
      true
    );
  }

  launch(vx, vy, countJump) {
    this.cat.setFlipX(vx < 0);
    this.cat.body.allowGravity = true;
    this.cat.setVelocity(vx, vy);
    this.state = 'flying';
    this.standingOn = null;
    if (countJump) { this.jumps++; this.updateHud(); }
    this.armOwner();
  }

  dragVector(p) {
    const dx = this.dragStart.x - p.x;
    const dy = this.dragStart.y - p.y;
    const dist = Math.min(Math.hypot(dx, dy), BALANCE.MAX_DRAG);
    return { dist, angle: Math.atan2(dy, dx) };
  }

  // ============================================================
  //  ХОЗЯИН
  // ============================================================
  armOwner() {
    if (!this.owner) return;
    this.ownerArmed = false;
    if (this.ownerTimer) this.ownerTimer.remove();
    const delay = Phaser.Math.Between(BALANCE.OWNER_DELAY_MIN, BALANCE.OWNER_DELAY_MAX);
    this.ownerTimer = this.time.delayedCall(delay, () => {
      this.ownerArmed = true;
      this.owner.setTint(0xE0706B);
      this.time.delayedCall(BALANCE.OWNER_ACTIVE_MS, () => {
        this.ownerArmed = false;
        this.owner.clearTint();
      });
    });
  }

  // ============================================================
  //  СЦЕНКА: упал предмет → хозяин встал → подушка
  // ============================================================
  dropFragile(kind, item) {
    this.state = 'scene';
    this.fallen[kind] = true;

    // 1. Предмет падает
    let sprite;
    if (kind === 'lampa') {
      sprite = this.lampa;
    } else {
      // телевизор: отдельный спрайт, который «сваливается» с комода
      const s = sizeOf(item.id);
      sprite = this.add.image(item.x, item.y - s.h * 0.28, 'podushka')
        .setTint(0x39434F).setDepth(4);
    }
    if (sprite) {
      this.tweens.add({
        targets: sprite,
        y: FLOOR_Y - 14,
        x: sprite.x + Phaser.Math.Between(-40, 40),
        angle: Phaser.Math.Between(70, 110),
        duration: 520, ease: 'Cubic.easeIn'
      });
    }
    this.say(pick(HAZARDS.padenie.lines));

    // 2. Хозяин садится и замахивается — это предупреждение игроку
    this.time.delayedCall(700, () => {
      if (!this.owner) return;
      this.owner.setTint(0xE0706B);
      this.tweens.add({
        targets: this.owner, y: this.ownerHome - 26, duration: 260, ease: 'Back.easeOut'
      });
      this.say('Он сел. Это плохой знак.');

      // 3. Бросок. Управление возвращается игроку СРАЗУ —
      //    подушка летит в точку, где кот был в момент броска,
      //    так что от неё можно увернуться прыжком.
      this.time.delayedCall(BALANCE.PILLOW_WARN_MS, () => {
        this.state = this.standingOn ? 'landed' : 'idle';

        const targetX = this.cat.x, targetY = this.cat.y;
        const pil = this.add.image(this.owner.x, this.owner.y - 10, 'podushka').setDepth(8);
        const dist = Phaser.Math.Distance.Between(pil.x, pil.y, targetX, targetY);
        this.pillow = pil;

        this.tweens.add({
          targets: pil,
          x: targetX, y: targetY,
          angle: 300,
          duration: (dist / BALANCE.PILLOW_SPEED) * 1000,
          ease: 'Linear',
          onComplete: () => {
            if (!this.pillow) return;          // уже попала — убрана в update
            this.pillow = null;
            this.tweens.add({
              targets: pil, alpha: 0, y: pil.y + 40, duration: 400,
              onComplete: () => pil.destroy()
            });
            this.say('Мимо. Он мазила.');
          }
        });

        // хозяин ложится обратно
        this.tweens.add({
          targets: this.owner, y: this.ownerHome, duration: 400, delay: 700,
          onComplete: () => this.owner.clearTint()
        });
      });
    });
  }

  // Проверка попадания подушки — вызывается каждый кадр
  checkPillow() {
    if (!this.pillow) return;
    const d = Phaser.Math.Distance.Between(
      this.pillow.x, this.pillow.y, this.cat.x, this.cat.y
    );
    if (d > BALANCE.PILLOW_HIT_RADIUS) return;

    const pil = this.pillow;
    this.pillow = null;
    this.tweens.killTweensOf(pil);
    pil.destroy();

    const away = this.cat.x < this.owner.x ? -1 : 1;
    this.say(pick(HAZARDS.podushka.lines));
    this.launch(away * 170, -330, false);
  }

  // ============================================================
  //  ПОЛЁТ
  // ============================================================
  update() {
    if (this.bubbleTx.alpha > 0 && this.state !== 'scene') this.placeBubble();
    this.checkPillow();
    if (this.state !== 'flying') return;

    this.stashSprites.forEach(sp => {
      if (!sp.active) return;
      if (Phaser.Math.Distance.Between(this.cat.x, this.cat.y, sp.x, sp.y) < 30) {
        const n = sp.getData('fish');
        this.runFish += n;
        const s = load();
        s.stashTaken.push(sp.getData('index'));
        s.fish += n;
        save(s);
        this.updateHud();
        this.say('Заначка. Я про неё помнил.');
        sp.destroy();
      }
    });

    const pt = new Phaser.Geom.Point(this.cat.x, this.cat.y);

    if (this.ownerArmed && this.ownerRect &&
        Phaser.Geom.Rectangle.ContainsPoint(this.ownerRect, pt)) {
      this.ownerArmed = false;
      this.land(null, 'hozyain');
      return;
    }
    if (Phaser.Geom.Rectangle.ContainsPoint(this.windowRect, pt)) {
      this.land(null, 'okno');
      return;
    }
    // вылетел за край — возвращаем на пол
    if (this.cat.x < -60 || this.cat.x > FIELD.w + 60 || this.cat.y > FIELD.h + 80) {
      this.cat.setVelocity(0, 0);
      this.cat.body.allowGravity = false;
      this.cat.setPosition(
        Phaser.Math.Clamp(this.cat.x, 40, FIELD.w - 40),
        FLOOR_Y - sizeOf('cat').h / 2
      );
      this.state = 'idle';
      this.standingOn = null;
      this.say('Я вышел. И вернулся. Не спрашивай.');
    }
  }

  // ============================================================
  //  ПРИЗЕМЛЕНИЕ
  // ============================================================
  land(item, kind, body) {
    if (this.state !== 'flying') return;

    const vx = this.cat.body.velocity.x;
    this.cat.setVelocity(0, 0);
    this.cat.body.allowGravity = false;
    if (this.ownerTimer) this.ownerTimer.remove();

    // --- пол: не провал, кот просто внизу и может прыгать дальше ---
    if (kind === 'pol') {
      this.state = 'idle';
      this.standingOn = null;
      this.cat.y = FLOOR_Y - sizeOf('cat').h / 2;
      const slideTo = Phaser.Math.Clamp(this.cat.x + vx * BALANCE.SLIDE_FACTOR, 30, FIELD.w - 30);
      this.tweens.add({ targets: this.cat, x: slideTo, duration: BALANCE.SLIDE_MS, ease: 'Cubic.easeOut' });
      this.say(pick(HAZARDS.pol.lines));
      return;
    }

    // --- окно или хозяин: сбило, падаем на пол ---
    if (kind !== 'platform') {
      this.state = 'landed';
      this.standingOn = null;
      this.say(pick(HAZARDS[kind].lines));
      this.time.delayedCall(900, () => {
        if (this.state === 'done' || this.state === 'scene') return;
        this.cat.setPosition(
          Phaser.Math.Clamp(this.cat.x, 40, FIELD.w - 40),
          FLOOR_Y - sizeOf('cat').h / 2
        );
        this.state = 'idle';
      });
      return;
    }

    // --- приземлился на мебель ---
    this.state = 'landed';
    this.standingOn = item;

    // Ставим лапы ровно на поверхность. По горизонтали кот остаётся там,
    // куда попал — это не «магнит», а только выравнивание по высоте.
    const topY = body ? body.body.top : (item.y - sizeOf(item.id).h / 2);
    this.cat.y = topY - sizeOf('cat').h / 2;

    const s = sizeOf(item.id), cs = sizeOf('cat');
    const left  = item.x - s.w / 2 + cs.w * 0.35;
    const right = item.x + s.w / 2 - cs.w * 0.35;
    const slideTo = Phaser.Math.Clamp(this.cat.x + vx * BALANCE.SLIDE_FACTOR, left, right);
    this.tweens.add({
      targets: this.cat, x: slideTo, duration: BALANCE.SLIDE_MS, ease: 'Cubic.easeOut'
    });

    if (!this.visited.includes(item.id) && item.fish) {
      this.visited.push(item.id);
      this.runFish += item.fish;
      addFish(item.fish);
      this.updateHud();
    }

    // --- цель достигнута ---
    if (item.id === this.task.goal) {
      this.state = 'done';
      this.say(pick(item.lines));
      const clean = this.jumps <= BALANCE.CLEAN_JUMP_LIMIT;
      const reward = clean ? BALANCE.TASK_REWARD_CLEAN : BALANCE.TASK_REWARD;
      addFish(reward);
      markTaskDone(this.task.id);
      this.time.delayedCall(1500, () => {
        this.scene.start('Result', {
          task: this.task, reward, clean, jumps: this.jumps, runFish: this.runFish + reward
        });
      });
      return;
    }

    // --- хрупкое: лампа или телевизор могут упасть ---
    if (item.fragile && !this.fallen[item.fragile] &&
        Math.random() < BALANCE.FRAGILE_CHANCE) {
      this.time.delayedCall(420, () => this.dropFragile(item.fragile, item));
      return;
    }

    this.say(pick(item.lines));
  }
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
