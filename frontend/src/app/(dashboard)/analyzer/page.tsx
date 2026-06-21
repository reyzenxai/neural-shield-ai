import { redirect } from "next/navigation";

/** /analyzer → default to the message scanner. */
export default function AnalyzerIndex() {
  redirect("/analyzer/message");
}
