export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">Privacy</h1>
      <div className="mt-6 space-y-4 text-gray-600">
        <p>
          This project is under active development. Publish a production privacy notice before collecting,
          storing, or processing identifiable user or patient information outside a local evaluation workflow.
        </p>
        <p>
          Until a production privacy program is documented, users should avoid entering identifiable patient
          information into public or shared deployments.
        </p>
      </div>
    </div>
  );
}
