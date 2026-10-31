import type { Metadata } from "next";
import DemoReplay from "../../components/demo-replay";

export const metadata: Metadata = {
  title: "ContractTwin | Recorded Sandbox Demonstration",
  description:
    "Explore a recorded PayPal invoice recovery and three contract decisions."
};

export default function DemoPage() {
  return <DemoReplay />;
}
