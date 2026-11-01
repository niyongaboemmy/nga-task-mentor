import React from "react";
import { KeyRound } from "lucide-react";
import Select from "../ui/Select";
import {
  choiceLabel,
  choiceValue,
  describeAiAnswer,
  myAiManageUrl,
  useMyAiRoutes,
  type AiAnswer,
  type MyAiRoutes,
} from "../../services/myAiApi";

/**
 * My AI (MY_AI_GATEWAY.md "UI in each app"):
 *   AiSourceControl  "Answers with: School AI ▾" before the call -- School AI, the
 *                    person's own keys (`choices`), and "Manage My AI ↗" (MIS /my-ai).
 *                    Shown only when My AI is on and the person has a key here; its
 *                    value goes in the request body as `aiRoute` ("" = their default).
 *   AiAnsweredBy     after the call: "via My Claude · model", or why School AI answered.
 */

const MANAGE = "__manage__";

export const AiSourceControl: React.FC<{
  value: string;
  onChange: (aiRoute: string) => void;
  /** Element id prefix (tests, labels). */
  idPrefix?: string;
  disabled?: boolean;
  className?: string;
  /** The task this panel runs ("author", "hint", …): its route is the default. */
  task?: string;
  /** Tests: skip the fetch. */
  routes?: MyAiRoutes | null;
}> = ({ value, onChange, idPrefix = "ai-source", disabled, className = "", task = "author", routes: given }) => {
  const fetched = useMyAiRoutes(given !== undefined);
  const routes = given !== undefined ? given : fetched;
  const choices = routes?.enabled ? routes.choices ?? [] : [];
  if (!choices.length) return null;
  // "" = no one-off choice: whatever the person set for this task in the MIS answers.
  const dflt = routes?.byTask?.[task];
  const personalDefault = dflt?.route === "personal";
  const defaultLabel = personalDefault
    ? choiceLabel({ credentialId: dflt.credentialId ?? 0, provider: dflt.provider ?? "", model: dflt.model ?? "", label: dflt.label })
    : "School AI";
  return (
    <div className={`flex flex-wrap items-center gap-2 text-sm ${className}`} data-testid={`${idPrefix}-control`}>
      <label htmlFor={`${idPrefix}-select`} className="inline-flex items-center gap-1.5 text-text-secondary-light dark:text-text-secondary-dark">
        <KeyRound className="w-3.5 h-3.5" aria-hidden />
        Answers with:
      </label>
      <Select
        id={`${idPrefix}-select`}
        size="sm"
        variant="outline"
        className="min-w-[12rem]"
        value={value}
        disabled={disabled}
        onValueChange={(v) => {
          if (v === MANAGE) {
            window.open(myAiManageUrl(), "_blank", "noopener,noreferrer");
            return;
          }
          onChange(v);
        }}
      >
        <option value="">{defaultLabel}</option>
        {personalDefault && <option value="school">School AI</option>}
        {choices
          .filter((c) => !(personalDefault && c.credentialId === dflt.credentialId && c.model === dflt.model))
          .map((c) => (
            <option key={choiceValue(c)} value={choiceValue(c)}>
              {choiceLabel(c)}
            </option>
          ))}
        <option value={MANAGE}>Manage My AI ↗</option>
      </Select>
    </div>
  );
};

export const AiAnsweredBy: React.FC<{ ai?: AiAnswer | null; className?: string }> = ({ ai, className = "" }) => {
  const text = describeAiAnswer(ai);
  if (!text) return null;
  const fellBack = ai?.route === "school";
  return (
    <p
      role="status"
      data-testid="ai-answered-by"
      className={`text-xs ${fellBack ? "text-amber-700 dark:text-amber-300" : "text-text-secondary-light dark:text-text-secondary-dark"} ${className}`}
    >
      {text}
    </p>
  );
};

export default AiSourceControl;
