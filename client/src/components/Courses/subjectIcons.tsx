import React from "react";
import {
  Binary,
  BookOpen,
  Briefcase,
  Calculator,
  Code2,
  Database,
  Dumbbell,
  FlaskConical,
  Globe2,
  HeartPulse,
  Languages,
  Monitor,
  Network,
  PenTool,
  Sprout,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from "lucide-react";

// A subject's icon, guessed from its name. Same rules as the MIS's My Subjects
// (nga_central_mis frontend/src/components/elearning/ui/subjectIcons.tsx) so a
// subject looks the same in both apps; keep the two lists in step.

interface SubjectIconDef {
  Icon: LucideIcon;
  match: RegExp;
}

// Order is the matching order: a specific subject must come before a broader
// one, or "Apply Basic Database Development" would be caught by programming.
const SUBJECT_ICONS: SubjectIconDef[] = [
  { Icon: Database, match: /database|sql|data manage|information system/i },
  { Icon: Network, match: /network|internet|telecom|cisco|server/i },
  { Icon: PenTool, match: /design|graphic|draw|art|multimedia|animation/i },
  { Icon: Code2, match: /program|coding|software|web|develop|php|java|python|script/i },
  { Icon: Monitor, match: /computer|ict|digital|hardware|operating system/i },
  { Icon: Calculator, match: /math|calcul|algebra|geometr|statis|numer/i },
  { Icon: FlaskConical, match: /physic|chem|biolog|science|laborator/i },
  { Icon: Languages, match: /english|french|kinyarwanda|swahili|language|literature|communicat/i },
  { Icon: Briefcase, match: /entrepreneur|business|account|finance|econom|market|manage/i },
  { Icon: Wrench, match: /electr|mechan|engineer|construct|build|weld|plumb|automot|machin/i },
  { Icon: Sprout, match: /agri|farm|crop|animal|veterin|forest|environment/i },
  { Icon: UtensilsCrossed, match: /food|culin|cook|hotel|tour|hospitality|bakery/i },
  { Icon: HeartPulse, match: /health|nurs|medic|care|hygien|safety/i },
  { Icon: Dumbbell, match: /sport|physical education|fitness|athlet/i },
  { Icon: Globe2, match: /histor|geograph|civic|social|citizen|politic/i },
  { Icon: Binary, match: /logic|algorithm|reason|discrete/i },
];

const SubjectIcon: React.FC<{ name: string; className?: string }> = ({ name, className = "w-5 h-5" }) => {
  const Icon = SUBJECT_ICONS.find((i) => i.match.test(name || ""))?.Icon ?? BookOpen;
  return <Icon className={className} aria-hidden />;
};

export default SubjectIcon;
