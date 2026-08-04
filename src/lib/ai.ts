import "server-only";

/**
 * Summarize a resume PDF into a short Korean blurb suitable for showing to
 * teammates (in place of the private full file). Uses OpenAI (gpt-4o-mini reads
 * the PDF directly). Returns null if no API key is configured or the call
 * fails — the caller should treat that as "no summary".
 */
export async function summarizeResumePdf(pdfBytes: Buffer): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const system =
    "당신은 인턴 관리 대시보드를 위해 인턴의 이력서를 요약합니다. " +
    "학력·전공, 주요 기술/역량, 눈에 띄는 경험을 담아 한국어로 2~3문장의 간결한 소개를 작성하세요. " +
    "요약문만 출력하고, 머리말·제목·목록·군더더기는 넣지 마세요.";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        max_tokens: 500,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: "이 이력서를 위 지침에 따라 요약해 주세요." },
              {
                type: "file",
                file: {
                  filename: "resume.pdf",
                  file_data: `data:application/pdf;base64,${pdfBytes.toString("base64")}`,
                },
              },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error("resume summary failed:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const text = (data.choices?.[0]?.message?.content ?? "").trim();
    return text || null;
  } catch (e) {
    console.error("resume summary failed:", (e as Error).message);
    return null;
  }
}
