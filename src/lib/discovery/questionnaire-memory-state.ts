import type { CountryCode } from 'libphonenumber-js';
import type { DiscoveryQuestionnaireAnswers } from './questionnaire-core';
import type { DiscoveryQuestionnaireStep } from './questionnaire-schema';

export type DiscoveryQuestionnaireSnapshot = {
  answers: DiscoveryQuestionnaireAnswers;
  currentStep: DiscoveryQuestionnaireStep;
  highestStepReached: DiscoveryQuestionnaireStep;
  phoneCountry: CountryCode;
  phoneInput: string;
  scopeId: string;
};

export type DiscoveryQuestionnaireStateStore = {
  clear(scopeId?: string): void;
  read(scopeId: string): DiscoveryQuestionnaireSnapshot | null;
  save(snapshot: DiscoveryQuestionnaireSnapshot): void;
};

export function createDiscoveryQuestionnaireStateStore(): DiscoveryQuestionnaireStateStore {
  let snapshot: DiscoveryQuestionnaireSnapshot | null = null;

  return {
    clear(scopeId) {
      if (!scopeId || snapshot?.scopeId === scopeId) snapshot = null;
    },
    read(scopeId) {
      return snapshot?.scopeId === scopeId ? snapshot : null;
    },
    save(nextSnapshot) {
      snapshot = nextSnapshot;
    },
  };
}
