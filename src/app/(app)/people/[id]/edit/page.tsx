import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { PersonForm } from "@/components/people/PersonForm";

export const dynamic = "force-dynamic";

export default async function EditPersonPage({ params }: { params: { id: string } }) {
  const person = await prisma.person.findUnique({ where: { id: params.id } });
  if (!person) notFound();

  return (
    <div className="pt-6 max-w-2xl">
      <h1 className="text-2xl font-semibold text-ink-900 mb-6">{person.firstName} {person.lastName} bearbeiten</h1>
      <Card>
        <PersonForm mode="edit" personId={person.id} initial={person as any} />
      </Card>
    </div>
  );
}
