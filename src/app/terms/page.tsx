import { LegalBackButton } from "@/components/legal-back-button";

const sections = [
  {
    title: "服务性质",
    body: "WiTH 是健康记录、AI 对话和个人洞察工具。产品中的 AI 回复、周报、月报、健康方案、提醒文案和洞察内容仅供健康管理参考，不构成医疗诊断、治疗建议或专业处方。",
  },
  {
    title: "AI 内容准确性",
    body: "AI 可能基于不完整、过期或误解的信息生成内容，因此回答未必正确无误。你应结合自己的实际情况判断，并在涉及疾病、用药、治疗、急症或心理危机时咨询合格专业人士。",
  },
  {
    title: "用户责任",
    body: "你需要确保输入的信息尽量真实、准确，并避免上传或输入与本服务无关的高度敏感信息。你也应妥善保管账号和密码，避免与他人共用账号。",
  },
  {
    title: "健康与紧急情况",
    body: "如果你出现胸痛、呼吸困难、严重过敏、意识异常、自伤风险或其他紧急情况，请立即联系当地急救服务或前往医疗机构。不要等待 AI 回复。",
  },
  {
    title: "Demo 声明",
    body: "本页面目前为演示版本，用于展示正式条款的大致结构和范围，不构成最终法律文本。正式上线前应由产品、法务和隐私合规人员审阅。",
  },
];

export default function TermsPage() {
  return (
    <LegalPageShell title="服务条款" updatedAt="Demo version · 2026-06-06">
      {sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <h2 className="text-lg font-medium text-on-surface">{section.title}</h2>
          <p className="text-sm leading-7 text-on-surface-variant">{section.body}</p>
        </section>
      ))}
    </LegalPageShell>
  );
}

function LegalPageShell({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex items-center justify-between gap-4">
          <LegalBackButton />
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.3em] text-on-surface-variant/70">WiTH</p>
            <h1 className="font-[var(--font-display)] text-3xl font-semibold text-on-surface">{title}</h1>
            <p className="mt-1 text-xs text-on-surface-variant">{updatedAt}</p>
          </div>
        </header>

        <div className="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-5 text-sm leading-7 text-on-surface-variant">
          本页面为 demo 文案，方便产品体验和评审。正式发布前，请替换为经过法律与隐私合规审阅的版本。
        </div>

        <article className="flex flex-col gap-7 rounded-3xl bg-surface p-6 shadow-[0_12px_40px_rgba(45,45,45,0.06)] md:p-8">
          {children}
        </article>
      </div>
    </main>
  );
}
