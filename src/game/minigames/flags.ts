import type Phaser from 'phaser';
import { getRun, type RunState } from '../flow/RunState';

/** A flag of the run (`run.flags`, see the flow's RunState); false when the run has no such flag, also on a branch where the field does not exist yet. */
export const runFlag = (game: Phaser.Game, name: string): boolean => !!(getRun(game) as RunState & { flags?: Record<string, boolean> }).flags?.[name];
