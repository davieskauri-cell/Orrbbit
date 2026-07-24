// Approach Confidence System — vibe-based openers shown after mutual acceptance.
export const ICEBREAKERS: Record<string, string[]> = {
  networking: [
    "Hey, are you {name} from Orrbbit?",
    "Looks like we both chose Networking.",
    "What are you working on at the moment?",
    "Want to chat for two minutes?",
  ],
  open_to_chat: [
    "Hey, are you {name} from Orrbbit?",
    "I saw you were open to chat.",
    "How's your day going?",
  ],
  coffee_drinks: [
    "Want to grab a quick coffee?",
    "Looks like we both chose coffee.",
    "Know any good spots nearby?",
  ],
  need_advice: [
    "Hey, I saw you wanted advice.",
    "Happy to listen if you want to chat.",
    "What's been on your mind?",
  ],
  relationship: [
    "Hey, I saw we both had the same intention.",
    "Would you like to say hi in person?",
    "No pressure, just thought I'd introduce myself.",
  ],
  gym_buddy: [
    "Hey, are you {name} from Orrbbit?",
    "Looks like we both want a training partner.",
    "What are you training today?",
  ],
  exploring: [
    "Hey, are you {name} from Orrbbit?",
    "Up for exploring the area together?",
    "Found anything cool around here?",
  ],
};

export function getIcebreakers(vibe: string | null | undefined, name: string) {
  const list = ICEBREAKERS[vibe || ""] || ICEBREAKERS.open_to_chat;
  return list.map((l) => l.replace("{name}", name));
}
