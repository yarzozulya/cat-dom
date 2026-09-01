// ============================================================
//  ТОЧКА ВХОДА
// ============================================================
//  Здесь только настройка игры и список сцен.
//  Никакой игровой логики в этом файле быть не должно.
// ============================================================

import Phaser from 'phaser';
import { FIELD } from './config/level.js';
import { BALANCE } from './config/balance.js';
import MenuScene from './scenes/MenuScene.js';
import LevelScene from './scenes/LevelScene.js';
import ResultScene from './scenes/ResultScene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#56504B',
  width: FIELD.w,
  height: FIELD.h,
  scale: {
    mode: Phaser.Scale.FIT,          // вписывается в любой экран, пропорции сохраняются
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: BALANCE.GRAVITY }, debug: false }
  },
  scene: [MenuScene, LevelScene, ResultScene]
});
