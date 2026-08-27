"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, ListTodo, Plus, StickyNote } from "lucide-react";
import { useTopicsData, topicProgress } from "@/lib/data/domains/topics";
import { relTime } from "@/lib/data/domains/notes";
import { Card, ProgressBar } from "@/components/ui/primitives";
import { TopicForm } from "@/components/forms/TopicForm";
import { Hydrate } from "@/lib/hydration";
import { DynamicIcon } from "@/lib/icons";

export default function LearningPage() {
  const router = useRouter();
  const { topics } = useTopicsData();
  const [creating, setCreating] = useState(false);

  return (
    <Hydrate>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <p className="max-w-xl text-[15px] leading-relaxed text-muted">
            One page per thing you&apos;re learning — its roadmap, resources, and the insights you pick up along the way.
          </p>
          <button
            onClick={() => setCreating(true)}
            className="btn-hero flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold"
          >
            <Plus className="h-4 w-4" /> New topic
          </button>
        </div>

        {topics.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-12 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-[18px] bg-accent-soft text-accent">
              <GraduationCap className="h-7 w-7" />
            </span>
            <p className="max-w-sm text-sm leading-relaxed text-muted">
              Create a page for each topic you&apos;re studying. Map what to learn, collect the best
              resources, and capture insights as you go.
            </p>
            <button
              onClick={() => setCreating(true)}
              className="btn-hero mt-1 rounded-full px-4 py-2 text-[13px] font-semibold"
            >
              Create your first topic
            </button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map((t) => {
              const progress = topicProgress(t);
              const roadmap = t.roadmap ?? [];
              const notes = t.notes ?? [];
              return (
                <button key={t.id} onClick={() => router.push(`/learning/default?id=${t.id}`)} className="block text-left">
                  <Card hover className="flex h-full flex-col justify-between gap-4 p-5">
                    <div className="flex items-start gap-3">
                      <span
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px]"
                        style={{ background: `${t.color || "#37c9b7"}22` }}
                      >
                        <DynamicIcon name={t.icon} className="h-5 w-5" style={{ color: t.color || "#37c9b7" }} />
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <h3 className="truncate font-display text-[16px] font-semibold text-text">{t.name}</h3>
                        {t.description && (
                          <p className="line-clamp-2 text-[12px] leading-snug text-faint">{t.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-auto space-y-2">
                      <div className="flex items-center gap-3 text-[11px] text-faint">
                        <span className="tabular flex items-center gap-1">
                          <ListTodo className="h-3 w-3" />
                          {roadmap.filter((x) => x?.done).length}/{roadmap.length}
                        </span>
                        <span className="tabular flex items-center gap-1">
                          <StickyNote className="h-3 w-3" /> {notes.length}
                        </span>
                        <span className="ml-auto">{relTime(t.touchedAt)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <ProgressBar value={progress} color={t.color} />
                        <span className="tabular shrink-0 text-[12px] font-medium text-muted">{progress}%</span>
                      </div>
                    </div>
                  </Card>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <TopicForm
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => router.push(`/learning/default?id=${id}`)}
      />
    </Hydrate>
  );
}
