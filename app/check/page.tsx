import { CheckView } from "@/components/cc/CheckView";

export default function CheckPage({ searchParams }: { searchParams: { example?: string } }) {
  return <CheckView exampleId={searchParams.example} />;
}
