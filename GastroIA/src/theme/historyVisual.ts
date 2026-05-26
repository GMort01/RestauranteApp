import { ViewStyle } from 'react-native';
import { Theme } from '../types';

export const historyVisualTailwind = {
  shell: 'rounded-[18px] border border-slate-200 bg-white px-3 py-3 shadow-[0_10px_26px_rgba(15,23,42,0.08)]',
  statCard: 'min-w-[92px] flex-1 rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2.5 shadow-[0_6px_18px_rgba(15,23,42,0.04)]',
  chartCard: 'rounded-[18px] border border-slate-200 bg-slate-50 px-3 py-3 shadow-[0_8px_22px_rgba(15,23,42,0.05)]',
  historyCard: 'rounded-[16px] border border-slate-200 bg-white px-3 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.05)]',
  low: 'bg-emerald-500 text-emerald-700',
  medium: 'bg-amber-500 text-amber-700',
  high: 'bg-rose-500 text-rose-700',
};

export const getHistoryVisualSystem = (theme: Theme) => {
  const softShadow: ViewStyle = {
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 22,
    elevation: 3,
  };

  const thinShadow: ViewStyle = {
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  };

  return {
    radiusLg: 18,
    radiusMd: 16,
    radiusSm: 14,
    softShadow,
    thinShadow,
    surfaces: {
      shell: {
        backgroundColor: theme.surface,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 18,
      },
      muted: {
        backgroundColor: theme.background,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 16,
      },
    },
    spendScale: {
      low: theme.success,
      medium: theme.primary,
      high: theme.error,
    },
  };
};