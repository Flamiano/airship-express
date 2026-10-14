import { redirect } from "next/navigation";

export default function LegacySpncLoginPage() {
  redirect("/spncAuth/login");
}
