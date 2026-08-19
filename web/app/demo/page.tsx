import DemoDashboardClient from "./DemoDashboardClient";
import { DEMO_DOCUMENTS } from "@/lib/demoData";

export default function DemoPage() {
  return <DemoDashboardClient initialDocuments={DEMO_DOCUMENTS} />;
}
