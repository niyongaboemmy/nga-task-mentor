import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { LayoutTemplate, Play } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import CodeAreaTabs from "../../components/code/CodeAreaTabs";
import StarterPicker from "../../components/code/StarterPicker";
import { saveProjectFiles } from "../../services/codeApi";
import type { Starter } from "../../services/catalogApi";
import { apiErrorMessage, projectsApi } from "../../services/projectsApi";

/**
 * Code › Starters (CODE_RUNNER_PLAN.md §7.7): every starter project, by
 * language and purpose. Preview one, try it in the Playground, or start a
 * project from it.
 */
const StartersPage: React.FC = () => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const createFrom = async (s: Starter) => {
    if (busy) return;
    const name = window.prompt("Name the new project", s.title);
    if (!name?.trim()) return;
    setBusy(true);
    try {
      const project = await projectsApi.create({ name: name.trim(), kind: "tm", language: s.language });
      await saveProjectFiles(project.id, null, s.files, `Started from “${s.title}”`);
      toast.success("Project created from the starter.");
      navigate(`/code/projects/${project.id}/edit`);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Couldn't create the project."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="starters-page">
      <PageHeader
        breadcrumb={[{ label: "Code", to: "/code/projects" }, { label: "Starters" }]}
        title="Starters"
        icon={<LayoutTemplate className="h-6 w-6 text-primary" aria-hidden="true" />}
        description="Ready-made projects for every language: a first program, an exercise with tests, a real project layout."
      />
      <CodeAreaTabs />
      <StarterPicker
        onUse={(s) => void createFrom(s)}
        useLabel="New project"
        previewActions={(s) => (
          <button
            type="button"
            onClick={() => navigate(`/code/playground?language=${encodeURIComponent(s.language)}&starter=${encodeURIComponent(s.id)}`)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold hover:bg-gray-50 dark:border-white/15 dark:hover:bg-white/5"
          >
            <Play className="h-4 w-4" aria-hidden="true" /> Try in the Playground
          </button>
        )}
      />
    </div>
  );
};

export default StartersPage;
