import type Phaser from 'phaser';
import { getRun } from '../flow/RunState';

/** A flag of the run (`run.flags`, see the flow's RunState); false when the run has no such flag. */
export const runFlag = (game: Phaser.Game, name: string): boolean => !!getRun(game).flags[name];
