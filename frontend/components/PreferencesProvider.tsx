'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Money } from '@/types';

export type Currency = 'EUR' | 'GBP' | 'USD';

export const CURRENCY_OPTIONS: { value: Currency; label: string }[] = [
  { value: 'EUR', label: 'Euro (€)' },
  { value: 'GBP', label: 'British Pound (£)' },
  { value: 'USD', label: 'US Dollar ($)' },
];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  EUR: '€',
  GBP: '£',
  USD: '$',
};

const PREFS_KEY = 'app_preferences';

interface StoredPrefs {
  currency?: Currency;
}

interface PreferencesContextValue {
  currency: Currency;
  currencySymbol: string;
  setCurrency: (c: Currency) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({
  children,
  initialCurrency,
}: {
  children: React.ReactNode;
  initialCurrency?: Currency;
}) {
  const [currency, setCurrencyState] = useState<Currency>(initialCurrency ?? 'EUR');

  useEffect(() => {
    if (initialCurrency) return;
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) {
        const prefs: StoredPrefs = JSON.parse(raw);
        if (prefs.currency && prefs.currency in CURRENCY_SYMBOLS) {
          setCurrencyState(prefs.currency);
        }
      }
    } catch {
      // ignore
    }
  }, [initialCurrency]);

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c);
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      const prefs: StoredPrefs = raw ? JSON.parse(raw) : {};
      localStorage.setItem(PREFS_KEY, JSON.stringify({ ...prefs, currency: c }));
    } catch {
      // ignore
    }
  }, []);

  return (
    <PreferencesContext.Provider
      value={{ currency, currencySymbol: CURRENCY_SYMBOLS[currency], setCurrency }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside <PreferencesProvider>');
  return ctx;
}

export function useFormatMoney(): (money: Money | undefined | null) => string {
  const { currency } = usePreferences();
  return useCallback(
    (money: Money | undefined | null): string => {
      if (!money) return '—';
      const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
      return symbol + parseFloat(money.value).toFixed(2);
    },
    [currency],
  );
}
