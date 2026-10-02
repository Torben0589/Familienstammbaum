import { Card } from "@/components/ui/Card";
import { PersonForm } from "@/components/people/PersonForm";

export default function NewPersonPage() {
  return (
    <div className="pt-6 max-w-2xl">
      <h1 className="text-2xl font-semibold text-ink-900 mb-6">Neue Person anlegen</h1>
      <Card>
        <PersonForm mode="create" />
      </Card>
    </div>
  );
}
