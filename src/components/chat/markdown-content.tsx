"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  text: string;
}

export function MarkdownContent({ text }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="leading-relaxed">{children}</p>,
        strong: ({ children }) => (
          <strong className="font-semibold text-on-surface">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-on-surface-variant">{children}</em>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-5 space-y-1 my-2">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-5 space-y-1 my-2">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        code: ({ children, className }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code className="bg-surface-container-high px-1.5 py-0.5 rounded text-sm font-mono text-on-surface">
                {children}
              </code>
            );
          }
          return (
            <pre className="bg-surface-container-high rounded-xl p-4 overflow-x-auto my-3">
              <code className="text-sm font-mono text-on-surface">
                {children}
              </code>
            </pre>
          );
        },
        h1: ({ children }) => (
          <h1 className="text-xl font-bold mt-4 mb-2 text-on-surface">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-lg font-bold mt-3 mb-2 text-on-surface">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-bold mt-2 mb-1 text-on-surface">
            {children}
          </h3>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-secondary/40 pl-4 italic text-on-surface-variant my-3">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="my-3 w-full overflow-x-auto rounded-md border border-outline-variant/50">
            <table className="min-w-max w-full border-collapse bg-surface text-sm">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-surface-container text-on-surface">
            {children}
          </thead>
        ),
        tbody: ({ children }) => (
          <tbody className="divide-y divide-outline-variant/40">
            {children}
          </tbody>
        ),
        tr: ({ children }) => (
          <tr className="divide-x divide-outline-variant/40">{children}</tr>
        ),
        th: ({ children }) => (
          <th className="whitespace-nowrap px-3 py-2.5 text-left font-semibold leading-snug">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="min-w-40 max-w-80 whitespace-normal px-3 py-3 align-top leading-relaxed text-on-surface-variant">
            {children}
          </td>
        ),
        hr: () => <hr className="border-outline-variant/30 my-4" />,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:opacity-80"
          >
            {children}
          </a>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
