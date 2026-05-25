/**
 * toast-config.tsx
 * Custom react-native-toast-message configuration.
 * Professional design with Ionicons — no emojis.
 * Usage: <Toast config={toastConfig} />
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type { ToastConfig, ToastConfigParams } from 'react-native-toast-message';
import { Colors } from '../../constants/colors';

// ─── Token map per type ───────────────────────────────────────────────────────

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

const VARIANT: Record<
  ToastVariant,
  {
    accent: string;
    iconBg: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    iconColor: string;
  }
> = {
  success: {
    accent:    Colors.primary,      // green-600
    iconBg:    '#dcfce7',
    icon:      'checkmark-circle',
    iconColor: Colors.primary,
  },
  error: {
    accent:    Colors.danger,       // red-500
    iconBg:    '#fee2e2',
    icon:      'close-circle',
    iconColor: Colors.danger,
  },
  info: {
    accent:    Colors.info,         // blue-500
    iconBg:    '#dbeafe',
    icon:      'information-circle',
    iconColor: Colors.info,
  },
  warning: {
    accent:    Colors.warning,      // amber-500
    iconBg:    '#fef3c7',
    icon:      'warning',
    iconColor: Colors.warning,
  },
};

// ─── Single card component ────────────────────────────────────────────────────

function ToastCard({ text1, text2, type = 'info' }: ToastConfigParams<any>) {
  const variant = VARIANT[type as ToastVariant] ?? VARIANT.info;

  return (
    <View style={[styles.card, { borderLeftColor: variant.accent }]}>
      {/* Colored icon */}
      <View style={[styles.iconWrap, { backgroundColor: variant.iconBg }]}>
        <Ionicons name={variant.icon} size={22} color={variant.iconColor} />
      </View>

      {/* Text block */}
      <View style={styles.textBlock}>
        {!!text1 && (
          <Text style={styles.title} numberOfLines={2}>
            {text1}
          </Text>
        )}
        {!!text2 && (
          <Text style={styles.subtitle} numberOfLines={3}>
            {text2}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderLeftWidth: 4,
    paddingVertical: 12,
    paddingRight: 16,
    paddingLeft: 12,
    marginHorizontal: 14,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: Platform.OS === 'ios' ? 0.10 : 0.18,
    shadowRadius: 12,
    elevation: 6,
    // Make sure nothing clips the shadow
    overflow: Platform.OS === 'android' ? 'visible' : undefined,
    minWidth: 280,
    maxWidth: 360,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 18,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
    marginTop: 1,
  },
});

// ─── Config export ────────────────────────────────────────────────────────────

export const toastConfig: ToastConfig = {
  success: (props) => <ToastCard {...props} type="success" />,
  error:   (props) => <ToastCard {...props} type="error" />,
  info:    (props) => <ToastCard {...props} type="info" />,
  warning: (props) => <ToastCard {...props} type="warning" />,
};
