import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Skill Loader — load SKILL.md files and format for system prompt injection
// ---------------------------------------------------------------------------

export interface LoadedSkill {
  name: string;
  description: string;
  content: string;
}

/**
 * Parse a SKILL.md file content into structured skill data.
 * Expects frontmatter delimited by ---
 */
function parseSkillFile(filePath: string, raw: string): LoadedSkill {
  const frontmatterMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    return {
      name: path.basename(filePath, ".md"),
      description: "",
      content: raw.trim(),
    };
  }

  const frontmatter = frontmatterMatch[1];
  const content = frontmatterMatch[2].trim();

  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  const descMatch = frontmatter.match(/^description:\s*([\s\S]*?)(?=\n\w|$)/m);

  return {
    name: nameMatch?.[1].trim() ?? path.basename(filePath, ".md"),
    description: descMatch?.[1].trim().replace(/\n\s+/g, " ") ?? "",
    content,
  };
}

/**
 * Load all skills from a directory.
 */
export async function loadSkillsFromDir(dirPath: string): Promise<LoadedSkill[]> {
  const skills: LoadedSkill[] = [];

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        const filePath = path.join(dirPath, entry.name);
        const raw = await fs.promises.readFile(filePath, "utf-8");
        skills.push(parseSkillFile(filePath, raw));
      }
    }
  } catch {
    // Directory doesn't exist or can't be read — return empty
  }

  return skills;
}

/**
 * Format skills for injection into the system prompt.
 * Uses XML-like tags as suggested by agentskills.io convention.
 */
export function formatSkillsForSystemPrompt(skills: LoadedSkill[]): string {
  if (skills.length === 0) return "";

  const blocks = skills.map((skill) => {
    return `<skill name="${skill.name}">
<description>${skill.description}</description>
<instructions>
${skill.content}
</instructions>
</skill>`;
  });

  return `## Available Skills

You have access to the following specialized skills. Activate the relevant skill when the user's request matches its trigger conditions.

${blocks.join("\n\n")}`;
}

/**
 * Load skills from the default chat skills directory.
 */
export async function loadChatSkills(): Promise<LoadedSkill[]> {
  const skillsDir = path.join(process.cwd(), "src/app/api/chat/skills");
  return loadSkillsFromDir(skillsDir);
}
