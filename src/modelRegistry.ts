/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PredictionModel } from './types';
import { poissonModel } from './poissonEngine';
import { poissonGammaModel } from './poissonGammaEngine';
import { dixonColesModel } from './dixonColesEngine';

export const availableModels: PredictionModel[] = [
  poissonModel,
  poissonGammaModel,
  dixonColesModel
];

export function getModelById(id: string): PredictionModel {
  const model = availableModels.find(m => m.id === id);
  if (!model) {
    // Default di ripiego per sicurezza
    return poissonModel;
  }
  return model;
}
