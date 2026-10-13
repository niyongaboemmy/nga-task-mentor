import React from "react";
import { RouteTabs } from "../ui/Tabs";

/** Code › Projects · Playground · Starters (CODE_RUNNER_PLAN.md §5.1). */
const CodeAreaTabs: React.FC = () => (
  <RouteTabs
    label="Code"
    tabs={[
      { id: "projects", label: "Projects", to: "/code/projects", end: true },
      { id: "playground", label: "Playground", to: "/code/playground" },
      { id: "starters", label: "Starters", to: "/code/starters" },
    ]}
  />
);

export default CodeAreaTabs;
