import { Redirect } from 'expo-router';

// This file is kept for backward compatibility only.
// All milk recording is handled by milk-sale-new.tsx
export default function MilkNewRedirect() {
  return <Redirect href="/(app)/production/milk-sale-new" />;
}
