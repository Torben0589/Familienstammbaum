import { PersonDetail } from "@/components/people/PersonDetail";

export default function PersonPage({ params }: { params: { id: string } }) {
  return <PersonDetail personId={params.id} />;
}
