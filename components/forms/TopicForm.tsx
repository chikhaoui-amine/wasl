"use client";

import { useState } from "react";
import { Modal, Field, FormFooter, ColorDots, IconPicker, inputCls } from "@/components/ui/Modal";
import { useTopicsData, TOPIC_COLORS, type Topic } from "@/lib/data/domains/topics";
import { TOPIC_ICONS, DEFAULT_ICON, type IconKey } from "@/lib/icons";

export function TopicForm(props: {
  open: boolean;
  onClose: () => void;
  topic?: Topic;
  onCreated?: (id: string) => void;
}) {
  if (!props.open) return null;
  return <TopicFormInner key={props.topic?.id ?? "new"} {...props} />;
}

function TopicFormInner({
  open,
  onClose,
  topic,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  topic?: Topic;
  onCreated?: (id: string) => void;
}) {
  const { addTopic, updateTopic, deleteTopic } = useTopicsData();

  const [name, setName] = useState(topic?.name ?? "");
  const [icon, setIcon] = useState<IconKey>(topic?.icon ?? DEFAULT_ICON);
  const [description, setDescription] = useState(topic?.description ?? "");
  const [color, setColor] = useState(topic?.color ?? TOPIC_COLORS[0]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const input = {
      name: name.trim(),
      icon,
      description: description.trim(),
      color,
    };
    if (topic) {
      await updateTopic(topic.id, input);
    } else {
      const t = await addTopic(input);
      onCreated?.(t.id);
    }
    onClose();
  };

  const isDirty = Boolean(name.trim() !== (topic?.name ?? "") || description.trim() !== (topic?.description ?? ""));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={topic ? "Edit topic" : "New learning topic"}
      preventBackdropClose={true}
      dirty={isDirty}
      confirmDiscardMessage="You have unsaved changes in this learning topic. Discard edits?"
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="What are you learning?">
          <input autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Topic name" />
        </Field>

        <Field label="Icon">
          <IconPicker value={icon} onChange={setIcon} icons={TOPIC_ICONS} accent={color} />
        </Field>

        <Field label="Why / where you're headed">
          <textarea rows={2} className={`${inputCls} resize-none`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="One line on what you want out of this" />
        </Field>

        <Field label="Color">
          <ColorDots value={color} onChange={setColor} colors={TOPIC_COLORS} />
        </Field>

        <FormFooter
          submitLabel={topic ? "Save changes" : "Create topic"}
          disabled={!name.trim()}
          onDelete={
            topic
              ? () => {
                  deleteTopic(topic.id);
                  onClose();
                }
              : undefined
          }
        />
      </form>
    </Modal>
  );
}
