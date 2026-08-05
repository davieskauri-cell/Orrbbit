import { Linking } from "react-native";

export const LEGAL_BASE = "https://www.orrbbit.com";

export const LEGAL_LINKS = {
  privacy: `${LEGAL_BASE}/privacy`,
  terms: `${LEGAL_BASE}/terms`,
  community_guidelines: `${LEGAL_BASE}/community-guidelines`,
  safety: `${LEGAL_BASE}/safety`,
  location_privacy: `${LEGAL_BASE}/location-privacy`,
  child_safety: `${LEGAL_BASE}/child-safety`,
  moderation_appeals: `${LEGAL_BASE}/moderation-appeals`,
  professional_services: `${LEGAL_BASE}/professional-services`,
  professional_verification: `${LEGAL_BASE}/professional-verification`,
  delete_account: `${LEGAL_BASE}/delete-account`,
  copyright: `${LEGAL_BASE}/copyright`,
  support: `${LEGAL_BASE}/support`,
  cookies: `${LEGAL_BASE}/cookies`,
  refunds: `${LEGAL_BASE}/refunds`,
  policies: `${LEGAL_BASE}/policies`,
} as const;

export type LegalKey = keyof typeof LEGAL_LINKS;

export const openLegal = (key: LegalKey) => {
  Linking.openURL(LEGAL_LINKS[key]).catch(() => {});
};
