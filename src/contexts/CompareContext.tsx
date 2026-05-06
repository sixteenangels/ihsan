import { createContext, useContext, useState, ReactNode } from 'react';

interface CompareContextType {
  compareItems: string[];
  addToCompare: (productId: string) => void;
  removeFromCompare: (productId: string) => void;
  clearCompare: () => void;
  isInCompare: (productId: string) => boolean;
  maxItems: number;
}

const CompareContext = createContext<CompareContextType | undefined>(undefined);

export function CompareProvider({ children }: { children: ReactNode }) {
  const [compareItems, setCompareItems] = useState<string[]>([]);
  const maxItems = 4;

  const addToCompare = (productId: string) => {
    if (compareItems.length >= maxItems) return;
    if (!compareItems.includes(productId)) {
      setCompareItems([...compareItems, productId]);
    }
  };

  const removeFromCompare = (productId: string) => {
    setCompareItems(compareItems.filter(id => id !== productId));
  };

  const clearCompare = () => {
    setCompareItems([]);
  };

  const isInCompare = (productId: string) => {
    return compareItems.includes(productId);
  };

  return (
    <CompareContext.Provider value={{
      compareItems,
      addToCompare,
      removeFromCompare,
      clearCompare,
      isInCompare,
      maxItems
    }}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  const context = useContext(CompareContext);
  if (!context) {
    throw new Error('useCompare must be used within a CompareProvider');
  }
  return context;
}
