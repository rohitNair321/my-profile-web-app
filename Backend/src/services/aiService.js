const OpenAI = require("openai");
const { supabase } = require('../db/supabaseClient');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


async function getProfile() {

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .limit(1)
    .single();

  return data;
}

async function askAI(message, role, guestId, sessionId, userId, isGuest) {
  const profile = await getProfile();
  const systemPrompt = await buildSystemPrompt(profile, role);
  const response = await client.responses.create({
    model: "o4-mini",
    input: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: message,
      },
    ],
  });

  await supabase.from("ai_usage").insert({
    session_id: sessionId,
    user_id: userId,
    role: role,
    is_guest: isGuest,
    guest_id: guestId,

    model: response.model,

    input_tokens: response.usage?.input_tokens,
    output_tokens: response.usage?.output_tokens,
    total_tokens: response.usage?.total_tokens,

    request_id: response.id
  });

  return response.output_text;
}

// ── Prompt builder ────────────────────────────────────────────────────────────
function buildSystemPrompt(profile, role) {
  const currentExp = profile.experiences?.find(e => e.present);
  const currentRole = currentExp
    ? `${currentExp.role} at ${currentExp.company}`
    : profile.currentCompany ?? "N/A";

  const companyNames = (profile.experiences ?? [])
    .map(e => e.company)
    .join(", ");

  const skillsList = (profile.skills ?? []).join(", ");

  const themeNames = (profile.themes ?? [])
    .map(t => t.name)
    .join(", ");

  const experienceSections = (profile.experiences ?? [])
    .map(exp => {
      const period = exp.present
        ? `${exp.startDate} Present`
        : `${exp.startDate} ${exp.endDate}`;

      const projects = (exp.projects ?? [])
        .map(p =>
          `      - **${p.title}** [${p.projectProgress}]
          Tech: ${p.technologies?.join(", ") ?? "N/A"}
          ${p.description}`
        )
        .join("\n");

      return `
  ### ${exp.role} — ${exp.company} (${period})
  ${exp.description}
 
  **Projects:**
${projects}`;
    })
    .join("\n");

  const openToWorkLine = profile.open_to_work
    ? `Yes, ${profile.full_name} is open to new opportunities.`
    : `${profile.full_name} is not actively looking but open to the right opportunity—${profile.email}.`;

  return `You are FolioAI, ${profile.full_name}'s technical rep. Professional, finance/wealth-tech savvy. Help visitors explore skills, projects, and value; nudge toward contact when natural.

Greetings: if role is admin (${role}): "Welcome back, ${profile.full_name}! How can I assist you with your profile today?" If guest (${role}): "Hello! I'm FolioAI, ${profile.full_name}'s personal AI assistant. Ask me anything about his work, skills, or projects."

Facts: Name ${profile.full_name} | Role ${currentRole} | ${profile.location} | ${profile.email} | ${profile.primary_phone} | LinkedIn ${profile.linkedin} | GitHub N/A | Site ${profile.website} | Companies ${profile.companyCount} | Projects ${profile.projectCount} | Company list: ${companyNames} | Skills: ${skillsList} | Themes (${(profile.themes ?? []).length}): ${themeNames} | Current theme: ${profile.currenttheme}

"This app" (Rohit profile site): showcase + FolioAI. Stack: Angular, Node, Express, Supabase, OpenAI. Built Angular 16→17→18→19. Use via ${profile.website}; guest: "Continue as Guest". Admin: ${profile.full_name} only. Contact: ${profile.email} or site form. Guest limit: 5 FolioAI questions; then email/form.

Summary:
${profile.description}

Experience & projects:
${experienceSections}

Format (match depth to question):
1) Lists (skills, companies, project titles, tech, themes): bullets only—names/titles, no blurbs or CTA.
2) Explain/describe/tell about X: header + context + bullets with tech/outcomes as needed.
3) Single fact: one line, no extras. Email→${profile.email}. Project count→${profile.projectCount} across ${profile.companyCount} companies. Theme count→${(profile.themes ?? []).length}: ${themeNames}. Open to work→${openToWorkLine}
4) Hi/hello: short greeting + one line on what you help with. "Who are you?"→FolioAI intro for ${profile.full_name}.
5) Hiring/collab intent: 3–4 strength bullets + one CTA (${profile.email} or LinkedIn).

Tone: enterprise polish; verbs like Engineered, Delivered, Implemented. No "Great question!" fillers. Markdown for UI.

When relevant, stress finance context: SSO/IdP, Highcharts, ag-Grid/PrimeNG/Material, production work (e.g. BofA, Handelsbanken, Fiserv).

Guardrails: only facts in this prompt; no invented credentials/salary/metrics. Missing detail→"I don't have that specific detail. You can reach ${profile.full_name} at ${profile.email} or LinkedIn." No raw HTML. No extra prose after list or one-line answers.`;
}

module.exports = { askAI, buildSystemPrompt };