'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import {
  createDiscoveryQuestionnaireStateStore,
  type DiscoveryQuestionnaireStateStore,
} from '@/lib/discovery/questionnaire-memory-state';
import type { DiscoveryDraftPersistenceController } from '@/lib/discovery/draft-persistence-core';
import type { DiscoverySubmissionClientController } from '@/lib/discovery/submission-client-core';

type DiscoveryQuestionnaireContextValue = {
  controllers: Map<string, DiscoveryDraftPersistenceController>;
  submissionControllers: Map<string, DiscoverySubmissionClientController>;
  store: DiscoveryQuestionnaireStateStore;
};

const DiscoveryQuestionnaireStateContext =
  createContext<DiscoveryQuestionnaireContextValue | null>(null);

function isDiscoveryPath(pathname: string) {
  return /(?:^|\/)discovery(?:\/|$)/u.test(pathname);
}

export function DiscoveryQuestionnaireStateProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [value] = useState<DiscoveryQuestionnaireContextValue>(() => ({
    controllers: new Map(),
    submissionControllers: new Map(),
    store: createDiscoveryQuestionnaireStateStore(),
  }));

  useEffect(() => {
    if (isDiscoveryPath(pathname)) return;
    value.store.clear();
    for (const controller of value.controllers.values()) controller.destroy();
    value.controllers.clear();
    value.submissionControllers.clear();
  }, [pathname, value]);

  return (
    <DiscoveryQuestionnaireStateContext.Provider value={value}>
      {children}
    </DiscoveryQuestionnaireStateContext.Provider>
  );
}

export function useDiscoveryQuestionnaireStateStore() {
  const value = useContext(DiscoveryQuestionnaireStateContext);
  if (!value) {
    throw new Error('Discovery questionnaire state provider is unavailable');
  }
  return value.store;
}

export function useDiscoveryDraftPersistenceController(
  scopeId: string,
  createController: () => DiscoveryDraftPersistenceController,
) {
  const value = useContext(DiscoveryQuestionnaireStateContext);
  if (!value) {
    throw new Error('Discovery questionnaire state provider is unavailable');
  }
  let controller = value.controllers.get(scopeId);
  if (!controller) {
    controller = createController();
    value.controllers.set(scopeId, controller);
  }
  return controller;
}

export function useDiscoverySubmissionController(
  scopeId: string,
  createController: () => DiscoverySubmissionClientController,
) {
  const value = useContext(DiscoveryQuestionnaireStateContext);
  if (!value) {
    throw new Error('Discovery questionnaire state provider is unavailable');
  }
  let controller = value.submissionControllers.get(scopeId);
  if (!controller) {
    controller = createController();
    value.submissionControllers.set(scopeId, controller);
  }
  return controller;
}
