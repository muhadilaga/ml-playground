# DevOS Shared Context — D:\Dev\Projects

> Read by all AI coding assistants (Cursor, Antigravity, Kiro, Hermes, OpenCode, FCC-Claude).
> Single source of truth for shared context. Project details live in each project's own AGENTS.md.

## 1. Project home
Every project lives in `D:\Dev\Projects\<project-name>\`. Never create projects outside this folder.

## 2. Obsidian vault — shared memory
Vault: `D:\Dev\Documents` ("DevOS Vault"). Plain Markdown — read and write directly.

| Folder | Purpose |
|---|---|
| `00 Inbox/` | Fleeting notes, triage later |
| `01 ADR/` | Architecture Decision Records |
| `02 Architecture/` | System architecture, workstation setup |
| `03 Projects/` | One note per project |
| `04 AI/` | Notes per AI tool (Hermes, Kiro, Ollama, OpenCode — add Cursor, Antigravity, FCC-Claude as needed) |
| `05 Research/` | Research notes |
| `06 Daily Notes/` | Daily logs |
| `07 Attachments/` | Binaries — don't read |
| `08 Templates/` | Templates for new notes |

## 3. Session protocol
1. **Start**: read `03 Projects/<project-name>.md` (create from template if missing). Skim today's daily note.
2. **Decide**: check `01 ADR/` before architectural choices; follow existing decisions.
3. **Finish**: write back durable learnings —
   - project lesson → `03 Projects/<project-name>.md`
   - tool lesson → `04 AI/<tool>.md`
   - architecture decision → new file in `01 ADR/`
   - stray idea → `00 Inbox/`
   - day summary → `06 Daily Notes/<today>.md`

## 4. Hard rules
- NEVER write secrets, API keys, tokens, or credentials into the vault or any AGENTS.md. Reference their location, never their value.
- NEVER invent project history. If a note doesn't exist, say so and create it.
- Match the existing language of each note (EN/ID).
- Keep notes tight: facts and decisions, not transcripts.
