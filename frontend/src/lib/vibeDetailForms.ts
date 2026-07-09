// Vibe Details ("Intent Card") form configuration — drives the dynamic form in
// app/vibe-details.tsx. Field types: single (one chip), multi (many chips), text.
export type DetailField = {
  key: string;
  label: string;
  type: "single" | "multi" | "text";
  options?: string[];
  placeholder?: string;
  showIf?: (d: Record<string, any>) => boolean;
};

export const VISIBILITY_LABELS: Record<string, string> = {
  public: "Nearby compatible users",
  after_view: "Only after profile view",
  after_accept: "Only after mutual accept",
  hidden: "Hidden",
};

const isRecruiterish = (d: any) =>
  ["Recruiter", "Founder", "Business owner", "Hiring manager"].includes(d.professional_identity);
const isJobSeeker = (d: any) => d.professional_identity === "Job seeker";
const needsAdvice = (d: any) => !d.advice_role || d.advice_role !== "Offering Advice";
const offersAdvice = (d: any) => d.advice_role === "Offering Advice" || d.advice_role === "Both";

export const VIBE_FORMS: Record<string, DetailField[]> = {
  open_to_chat: [
    { key: "intent", label: "Specific intention", type: "single", options: ["Casual chat", "Meet new people", "New to the area", "Deep conversation", "Just being social", "Open to anything respectful"] },
    { key: "context", label: "Short context", type: "text", placeholder: "What kind of conversation are you open to?" },
    { key: "looking_for", label: "Looking for", type: "multi", options: ["Friendly people", "Similar interests", "Someone nearby", "A quick conversation", "A deeper conversation"] },
    { key: "can_offer", label: "Can offer", type: "multi", options: ["Good conversation", "Local tips", "Listening ear", "Friendly energy"] },
    { key: "tags", label: "Tags", type: "multi", options: ["Music", "Coffee", "Sport", "Travel", "Business", "Fitness", "Food", "Books", "Culture", "New friends"] },
  ],
  relationship: [
    { key: "relationship_intention", label: "Relationship intention", type: "single", options: ["Long-term relationship", "Open to dating", "Friends first", "Serious relationship", "Casual dating", "See where it goes"] },
    { key: "looking_for", label: "Looking for", type: "multi", options: ["Genuine connection", "Shared values", "Good conversation", "Someone emotionally mature", "Someone active", "Someone ambitious"] },
    { key: "context", label: "About me", type: "text", placeholder: "Tell people what kind of person you are." },
    { key: "values", label: "Relationship values", type: "multi", options: ["Loyalty", "Family", "Ambition", "Faith/spirituality", "Fitness", "Travel", "Communication", "Humour", "Kindness", "Stability"] },
  ],
  coffee_drinks: [
    { key: "intent", label: "Specific intention", type: "single", options: ["Coffee", "Drinks", "Quick catch-up", "Food nearby", "After-work drink", "Weekend social", "Study break", "Business coffee"] },
    { key: "looking_for", label: "Looking for", type: "multi", options: ["Someone to grab coffee with", "A relaxed conversation", "Quick social break", "New local spot", "Friendly meetup"] },
    { key: "setting", label: "Preferred setting", type: "single", options: ["Cafe", "Bar", "Casual restaurant", "Public place", "Outdoor area"] },
    { key: "time", label: "Time", type: "single", options: ["Now", "In 15 minutes", "In 30 minutes", "Later today"] },
    { key: "tags", label: "Tags", type: "multi", options: ["Coffee", "Food", "Wine bar", "Mocktails", "Casual chat", "New friends", "Business chat"] },
  ],
  networking: [
    { key: "professional_identity", label: "Professional identity", type: "single", options: ["Founder", "Business owner", "Student", "Freelancer", "Recruiter", "Job seeker", "Investor", "HR professional", "Tech professional", "Creative", "Sales professional", "Marketing professional", "Hiring manager", "Other"] },
    { key: "background", label: "Background", type: "text", placeholder: "Tell people your background." },
    { key: "experience_level", label: "Experience level", type: "single", options: ["Student", "Entry level", "1-3 years", "3-5 years", "5-10 years", "10+ years", "Founder / owner"] },
    { key: "industry", label: "Industry", type: "single", options: ["Tech", "HR", "Marketing", "Sales", "Finance", "Real estate", "Fitness", "Hospitality", "Health", "Education", "Trades", "Creative", "Startup", "Other"] },
    { key: "looking_for", label: "Looking for", type: "multi", options: ["Business contacts", "Advice", "Collaborators", "Mentors", "Investors", "Clients", "Job opportunities", "Hiring talent", "Coffee chat", "Industry connections"] },
    { key: "can_help_with", label: "Can help with", type: "multi", options: ["Career advice", "HR", "Marketing", "Sales", "Business strategy", "Tech", "Finance", "Operations", "Startups", "Recruitment", "Leadership", "Networking"] },
    // Hiring / Recruiter Mode
    { key: "recruiter_mode", label: "Hiring / Recruiter Mode", type: "single", options: ["Yes, I'm hiring", "Not hiring"], showIf: isRecruiterish },
    { key: "company", label: "Company name", type: "text", placeholder: "Company", showIf: (d) => isRecruiterish(d) && d.recruiter_mode === "Yes, I'm hiring" },
    { key: "hiring_roles", label: "Hiring for", type: "multi", options: ["Tech", "Software engineering", "Sales", "Marketing", "HR", "Finance", "Operations", "Customer service", "Hospitality", "Trades", "Graduate roles", "Internships", "Other"], showIf: (d) => isRecruiterish(d) && d.recruiter_mode === "Yes, I'm hiring" },
    { key: "hiring_experience", label: "Experience level needed", type: "single", options: ["Entry level", "Graduate", "1-3 years", "3-5 years", "5+ years", "Senior", "Leadership"], showIf: (d) => isRecruiterish(d) && d.recruiter_mode === "Yes, I'm hiring" },
    { key: "work_type", label: "Work type", type: "single", options: ["Full-time", "Part-time", "Casual", "Contract", "Internship", "Freelance"], showIf: (d) => isRecruiterish(d) && d.recruiter_mode === "Yes, I'm hiring" },
    { key: "location_type", label: "Location type", type: "single", options: ["On-site", "Hybrid", "Remote"], showIf: (d) => isRecruiterish(d) && d.recruiter_mode === "Yes, I'm hiring" },
    { key: "salary_range", label: "Salary range (optional)", type: "text", placeholder: "e.g. $80k-$110k", showIf: (d) => isRecruiterish(d) && d.recruiter_mode === "Yes, I'm hiring" },
    // Job Seeker
    { key: "current_role", label: "Current role", type: "text", placeholder: "e.g. Junior Developer", showIf: isJobSeeker },
    { key: "target_role", label: "Target role", type: "text", placeholder: "e.g. Frontend Developer", showIf: isJobSeeker },
    { key: "skills", label: "Skills", type: "text", placeholder: "e.g. React, JavaScript, UI design", showIf: isJobSeeker },
    { key: "open_to_recruiters", label: "Open to recruiters", type: "single", options: ["Yes", "No"], showIf: isJobSeeker },
    { key: "linkedin", label: "LinkedIn (optional)", type: "text", placeholder: "Profile link (placeholder)", showIf: isJobSeeker },
  ],
  need_advice: [
    { key: "advice_role", label: "I am…", type: "single", options: ["Need Advice", "Offering Advice", "Both"] },
    { key: "advice_category", label: "Advice category", type: "single", options: ["Career advice", "Relationship advice", "Business advice", "Study advice", "Life advice", "Fitness advice", "Moving city advice", "Confidence", "Mental load", "Decision making", "Other"], showIf: needsAdvice },
    { key: "context", label: "Short context", type: "text", placeholder: "What do you need advice about?", showIf: needsAdvice },
    { key: "looking_for", label: "Looking for someone with", type: "multi", options: ["Experience in this area", "Same industry", "More experienced perspective", "Similar life experience", "Professional background", "Someone who will listen"], showIf: needsAdvice },
    { key: "urgency", label: "Urgency", type: "single", options: ["Just curious", "Would like advice today", "Need to talk soon", "Not urgent"], showIf: needsAdvice },
    { key: "comfort_level", label: "Comfort level", type: "single", options: ["Quick chat", "Coffee chat", "Deep conversation", "Anonymous at first"], showIf: needsAdvice },
    { key: "offer_categories", label: "I can help with", type: "multi", options: ["Career", "HR", "Business", "Fitness", "Study", "Relationships", "Confidence", "Moving city", "Startups", "Leadership", "Finance", "Marketing", "Tech"], showIf: offersAdvice },
    { key: "offer_experience", label: "Experience", type: "single", options: ["Lived experience", "Professional experience", "Manager / leader", "Founder", "Student", "Coach / mentor", "Other"], showIf: offersAdvice },
    { key: "tags", label: "Tags", type: "multi", options: ["Career", "HR", "Business", "Study", "Life", "Fitness", "Confidence", "Next Steps"] },
  ],
  gym_buddy: [
    { key: "training_type", label: "Training type", type: "multi", options: ["Weights", "Cardio", "Running", "Walking", "Boxing", "Yoga", "Pilates", "CrossFit", "Sport", "Golf", "General fitness"] },
    { key: "experience_level", label: "Experience level", type: "single", options: ["Beginner", "Intermediate", "Advanced", "Competitive"] },
    { key: "looking_for", label: "Looking for", type: "multi", options: ["Training partner", "Accountability", "Walking buddy", "Gym session", "Running partner", "Sport partner"] },
    { key: "preferred_time", label: "Preferred time", type: "multi", options: ["Morning", "Lunch", "Afternoon", "Evening", "Weekend"] },
    { key: "context", label: "Short context", type: "text", placeholder: "e.g. Looking for a weights partner after work." },
  ],
  exploring: [
    { key: "intent", label: "Exploring intention", type: "single", options: ["New to the area", "City walk", "Food spots", "Local attractions", "Events nearby", "Shopping", "Nature/walks", "Nightlife", "Hidden gems"] },
    { key: "looking_for", label: "Looking for", type: "multi", options: ["Someone to explore with", "Local recommendations", "Group plans", "Walking buddy", "Food buddy"] },
    { key: "time", label: "Time", type: "single", options: ["Now", "Later today", "This weekend"] },
    { key: "context", label: "Short context", type: "text", placeholder: "e.g. New to the area and looking for good food spots." },
  ],
  busy: [
    { key: "busy_setting", label: "While busy", type: "single", options: ["Busy for now", "Do not disturb", "Visible but not available", "Hide me completely"] },
  ],
};

// The headline shown on cards — some vibes store it under a dedicated key.
export const INTENT_KEYS: Record<string, string> = {
  relationship: "relationship_intention",
  networking: "professional_identity",
  need_advice: "advice_category",
  gym_buddy: "training_type",
};

export function detailsHeadline(vibeKey: string | null, d: Record<string, any> | undefined): string | null {
  if (!d) return null;
  if (d.intent) return d.intent;
  const k = vibeKey ? INTENT_KEYS[vibeKey] : undefined;
  const v = k ? d[k] : null;
  if (Array.isArray(v)) return v.join(", ") || null;
  return v || null;
}
