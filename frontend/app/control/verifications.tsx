import { Redirect } from 'expo-router';

/** Merged into the Professionals screen — keep old links/notifications working. */
export default function VerificationsRedirect() {
  return <Redirect href={'/control/professionals?tab=verification' as any} />;
}
