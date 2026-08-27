import { Suspense } from "react";
import TopicClient from "./TopicClient";

export function generateStaticParams() {
  return [{ topicId: "default" }];
}

export default function TopicPage() {
  return (
    <Suspense>
      <TopicClient />
    </Suspense>
  );
}
