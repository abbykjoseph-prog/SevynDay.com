import { redirect } from "next/navigation";

// The cinematic experience now lives at the root `/`. This route is kept as an
// alias so any previously-shared /experience links still work — it redirects to
// the homepage.
export default function ExperienceRedirect() {
  redirect("/");
}
