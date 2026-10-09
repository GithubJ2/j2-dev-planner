// Turns a messy dump (notes, an email thread, screenshots) into clean ProjectR tasks.
//   POST /dump-tasks  { project_id, text, images: [dataUrl...], team: [names], answers?: {q: a} }
//   -> { tasks: [{ title, people:[{name,kind}], due, tag, help, subtasks:[...] }], questions: [string] }
// Signed-in, approved ProjectR users only (checked below with the caller's own token). Needs the ANTHROPIC_API_KEY secret.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Sign in first" }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: u } = await supabase.auth.getUser(auth.slice(7));
  if (!u?.user) return json({ error: "Sign in first" }, 401);
  const { data: ok } = await supabase.rpc("is_approved");
  if (!ok) return json({ error: "Your account is not approved yet" }, 403);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "AI is not set up yet (missing ANTHROPIC_API_KEY)" }, 503);

  let body: { project_id?: string; text?: string; images?: string[]; team?: string[]; answers?: Record<string, string>; project_name?: string };
  try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const text = (body.text || "").slice(0, 20000);
  const images = (body.images || []).slice(0, 6);
  if (!text.trim() && !images.length) return json({ error: "Nothing to read" }, 400);

  const today = new Date().toISOString().slice(0, 10);
  const team = (body.team || []).slice(0, 30).join(", ") || "unknown";
  const system = `You turn messy notes into a short, clean task list for a small team's tracker (ProjectR). Today is ${today}. Team members: ${team}.
Rules:
- Output ONLY JSON: {"tasks":[...],"questions":[...]}.
- Each task: {"title": short imperative (max 80 chars), "people":[{"name":"<team member>","kind":"owner"|"waiting"}], "due":"YYYY-MM-DD" or "", "tag":"critical"|"blocker"|"", "help": 1-3 plain sentences on what to do and why, "subtasks":[{same shape, no subtasks}]}.
- "owner" = the person who must do it. "waiting" = someone the owner is waiting on (outside help, approval, a reply).
- Only use team names given above. If the text names someone not in the team, put them as "waiting" with that name.
- Group small steps under one task as subtasks. Don't invent work that isn't in the text. Max 12 tasks.
- Turn relative dates ("Friday", "next week", "EOD") into real dates from today. If no date, use "".
- "tag": critical if the dump says urgent/ASAP/launch-blocking; blocker if it stops other work; else "".
- "questions": at most 3 short questions, only for things that truly matter and are missing (who owns it, by when). Phrase each so a one-line answer settles it. Never ask about things already answered.
- If "answers" are given, use them and don't ask again. Write in plain British English.`;

  const content: Array<Record<string, unknown>> = [];
  for (const img of images) {
    const m = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,(.+)$/.exec(img);
    if (m) content.push({ type: "image", source: { type: "base64", media_type: m[1] === "image/jpg" ? "image/jpeg" : m[1], data: m[2] } });
  }
  const answers = body.answers && Object.keys(body.answers).length ? "\n\nAnswers to your earlier questions:\n" + Object.entries(body.answers).map(([q, a]) => `Q: ${q}\nA: ${a}`).join("\n") : "";
  content.push({ type: "text", text: `Project: ${body.project_name || "unknown"}\n\nDump:\n${text || "(see images)"}${answers}` });

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: Deno.env.get("AI_MODEL") || "claude-sonnet-5-5", max_tokens: 4000, system, messages: [{ role: "user", content }, { role: "assistant", content: "{" }] }),
  });
  if (!r.ok) return json({ error: "AI call failed: " + (await r.text()).slice(0, 300) }, 502);
  const out = await r.json();
  const raw = "{" + (out.content?.map((c: { text?: string }) => c.text || "").join("") || "");
  let parsed: { tasks?: unknown[]; questions?: unknown[] };
  try { parsed = JSON.parse(raw.slice(0, raw.lastIndexOf("}") + 1)); } catch { return json({ error: "AI gave an unreadable answer. Try again or shorten the dump." }, 502); }

  const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  const clean = (t: any, sub = false) => ({
    title: str(t?.title, 120),
    people: Array.isArray(t?.people) ? t.people.filter((p: any) => str(p?.name, 60)).map((p: any) => ({ name: str(p.name, 60), kind: p.kind === "waiting" ? "waiting" : "owner" })).slice(0, 6) : [],
    due: /^\d{4}-\d{2}-\d{2}$/.test(t?.due) ? t.due : "",
    tag: ["critical", "blocker"].includes(t?.tag) ? t.tag : "",
    help: str(t?.help, 1000),
    subtasks: sub ? [] : (Array.isArray(t?.subtasks) ? t.subtasks.map((s: any) => clean(s, true)).filter((s: any) => s.title).slice(0, 12) : []),
  });
  const tasks = (Array.isArray(parsed.tasks) ? parsed.tasks : []).map((t) => clean(t)).filter((t) => t.title).slice(0, 12);
  const questions = (Array.isArray(parsed.questions) ? parsed.questions : []).map((q) => str(q, 200)).filter(Boolean).slice(0, 3);
  return json({ tasks, questions });
});
