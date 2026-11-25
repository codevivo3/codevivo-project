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

const DiscoveryQuestionnaireStateContext =
  createContext<DiscoveryQuestionnaireStateStore | null>(null);

function isDiscoveryPath(pathname: string) {
  return /(?:^|\/)discovery(?:\/|$)/u.test(pathname);
}

export function DiscoveryQuestionnaireStateProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [store] = useState<DiscoveryQuestionnaireStateStore>(
    createDiscoveryQuestionnaireStateStore,
  );

  useEffect(() => {
    if (!isDiscoveryPath(pathname)) store.clear();
  }, [pathname, store]);

  return (
    <DiscoveryQuestionnaireStateContext.Provider value={store}>
      {children}
    </DiscoveryQuestionnaireStateContext.Provider>
  );
}

export function useDiscoveryQuestionnaireStateStore() {
  const store = useContext(DiscoveryQuestionnaireStateContext);
  if (!store) {
    throw new Error('Discovery questionnaire state provider is unavailable');
  }
  return store;
}
