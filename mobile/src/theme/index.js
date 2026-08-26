// Paleta corporativa GDP + modo oscuro
export const palette = {
  primary: '#0F172A',      // slate-900 (corporativo)
  accent: '#2563EB',       // blue-600
  success: '#059669',
  warning: '#EA580C',
  danger: '#DC2626',
  info: '#0891B2',
};

export const light = {
  dark: false,
  colors: {
    primary: palette.primary,
    background: '#F1F5F9',
    card: '#FFFFFF',
    text: '#0F172A',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    border: '#E2E8F0',
    accent: palette.accent,
    success: palette.success,
    warning: palette.warning,
    danger: palette.danger,
    info: palette.info,
    input: '#FFFFFF',
    placeholder: '#94A3B8',
    chipActive: palette.primary,
    chipTextActive: '#FFFFFF',
  },
};

export const dark = {
  dark: true,
  colors: {
    primary: '#0EA5E9',
    background: '#0B1220',
    card: '#1E293B',
    text: '#F1F5F9',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    border: '#334155',
    accent: '#3B82F6',
    success: '#10B981',
    warning: '#F97316',
    danger: '#F87171',
    info: '#22D3EE',
    input: '#1E293B',
    placeholder: '#64748B',
    chipActive: '#2563EB',
    chipTextActive: '#FFFFFF',
  },
};
