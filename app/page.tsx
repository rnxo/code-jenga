import HandTracker from "@/components/HandTracker";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <h1 className="mb-8 text-center text-4xl font-bold">
        🧱 Code Jenga
      </h1>

      <HandTracker />
    </main>
  );
}
