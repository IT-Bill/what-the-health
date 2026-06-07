import { LegalBackButton } from "@/components/legal-back-button";

const sections = [
  {
    title: "我们可能收集的信息",
    body: "为了提供健康记录、AI 对话、报告生成和提醒服务，WiTH 可能处理你的账号信息、健康数据、情绪记录、习惯完成情况、聊天内容、上传图片、设备导入记录和使用日志。",
  },
  {
    title: "数据如何用于 AI 功能",
    body: "当你使用聊天、健康方案、报告、洞察或提醒文案等 AI 功能时，相关上下文可能会被发送给模型服务用于生成结果。我们会尽量只发送完成功能所需的信息。",
  },
  {
    title: "敏感信息提醒",
    body: "请避免输入身份证号、银行卡号、完整住址、第三方账号密码或与健康服务无关的高度敏感信息。健康和医疗相关数据本身较敏感，请在使用前确认你愿意提交。",
  },
  {
    title: "数据控制",
    body: "你可以在产品内查看、更新或删除部分个人资料、健康连接、提醒和内容记录。未来正式版本应提供更完整的数据导出、删除和授权管理能力。",
  },
  {
    title: "安全与保留",
    body: "我们会采用合理的技术和管理措施保护数据安全，并仅在实现产品目的、履行法律义务或排查安全问题所需的期限内保留数据。",
  },
  {
    title: "Demo 声明",
    body: "本页面目前为演示版本，用于展示正式隐私政策的大致结构和范围，不构成最终法律文本。正式上线前应由产品、法务和隐私合规人员审阅。",
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex items-center justify-between gap-4">
          <LegalBackButton />
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.3em] text-on-surface-variant/70">WiTH</p>
            <h1 className="font-[var(--font-display)] text-3xl font-semibold text-on-surface">隐私政策</h1>
            <p className="mt-1 text-xs text-on-surface-variant">Demo version · 2026-06-06</p>
          </div>
        </header>

        <div className="rounded-3xl border border-outline-variant/20 bg-surface-container-low p-5 text-sm leading-7 text-on-surface-variant">
          本页面为 demo 文案，方便产品体验和评审。正式发布前，请替换为经过法律与隐私合规审阅的版本。
        </div>

        <article className="flex flex-col gap-7 rounded-3xl bg-surface p-6 shadow-[0_12px_40px_rgba(45,45,45,0.06)] md:p-8">
          {sections.map((section) => (
            <section key={section.title} className="flex flex-col gap-2">
              <h2 className="text-lg font-medium text-on-surface">{section.title}</h2>
              <p className="text-sm leading-7 text-on-surface-variant">{section.body}</p>
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}
