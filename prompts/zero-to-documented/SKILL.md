---
name: zero-to-documented
description: Build a complete, documented pi extension from scratch (zero → plan → scaffold → implement → document → validate → install)
---

# Zero to Documented Extension

You are tasked with building a complete, documented pi extension from scratch based on a user's goal. Follow this complete workflow:

## Input

The user will provide a goal such as:
- "create an extension that blocks dangerous file writes"
- "make an extension that adds a custom tool for git operations"
- "build an extension that injects system prompt guidance"

## Complete Workflow

### Phase 1: Plan (mode: plan)

Call the `extension_creator` tool with:
```
mode: "plan"
goal: "<user's goal>"
extensionKind: "<inferred type>" (optional)
```

**From the response, extract:**
- Extension type (tool, command, prompt, provider)
- Package name (kebab-case)
- Required files structure
- Key steps and cautions

### Phase 2: Scaffold (mode: scaffold)

Call the `extension_creator` tool with:
```
mode: "scaffold"
goal: "<user's goal>"
extensionKind: "<type from phase 1>"
path: "<external workspace path>"
```

**Create the files:**
1. Create the external workspace directory
2. Initialize `package.json` (use the plan's package name)
3. Create `tsconfig.json` for TypeScript
4. Create the entrypoint file (named, not index.ts)
5. Create prompt templates in `prompts/` if needed

### Phase 3: Implement

**Write the actual code:**
- Implement the extension logic in the entrypoint TypeScript file
- Register tools/commands as needed
- Follow the "Clean architecture by default" principles:
  - One responsibility per extension
  - Minimal event hooks
  - Small and obvious file layout
  - No unnecessary UI or hidden side effects

**Validate as you code:**
- Ensure TypeScript compiles: `npx tsc --noEmit`
- Check package.json has explicit entrypoint
- Verify named entrypoint (not index.ts)

### Phase 4: Document (mode: document)

Call the `extension_creator` tool with:
```
mode: "document"
path: "<external workspace path>"
extensionKind: "<type>"
```

**Then, using the guidance returned:**
1. **Read the source code** at the path
2. **Analyze** the structure, dependencies, and purpose
3. **Generate README.md**:
   - Use flat-square badges (TypeScript, License, Pi Extension)
   - Follow the style from `prompts/documentation.md`
   - Include: Features, Tools/Commands, Quick Start, Usage, Development
   - Add emojis sparingly (🔍, 🛠️, 📦, ✨)
   - Reference web-search extension style: https://github.com/Immac/pi-extension-builder

4. **Generate ARCHITECTURE.md** (optional):
   - Only if extension has complex architecture (multiple agents, state management)
   - Include: Purpose, Components, Principles, Interaction flows

5. **Write the files** to the extension path

### Phase 5: Validate (mode: validate)

Call the `extension_creator` tool with:
```
mode: "validate"
path: "<external workspace path>"
```

**Check the validation result:**
- If `status: "fail"`: Fix errors and re-validate
- If `status: "warn"`: Address warnings (optional cleanup)
- If `status: "pass"`: Ready for install

### Phase 6: Review (mode: review)

Call the `extension_creator` tool with:
```
mode: "review"
path: "<external workspace path>"
```

**Ensure:**
- No command sprawl
- Clean, minimal structure
- Easy reviewability

### Phase 7: Install (mode: install) - Optional

If the user wants to install:
```
mode: "install"
path: "<external workspace path>"
installTarget: "global" or "local" (optional)
```

## Output Format

At each phase, report:
```
## Phase X: <Phase Name>

**Tool Call:** (if applicable)
<details of tool call>

**Actions Taken:**
- <action 1>
- <action 2>

**Files Created/Modified:**
- `<path>`: <description>

**Next Step:** <what happens next>
```

## Pi Extension Examples

Study these real extension patterns from `pi-coding-agent/examples`:

### Simple Tool Extension (with-deps)
- **Pattern**: Register a single tool using `pi.registerTool()`
- **Structure**: Simple, single file, minimal
```typescript
export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "tool_name",
    label: "Tool Label",
    description: "What it does",
    parameters: Type.Object({ /* ... */ }),
    execute: async (_id, params) => { /* ... */ }
  });
}
```

### Complex Extension with Multiple Files (sandbox)
- **Pattern**: Replace built-in tool with enhanced version
- **Features**: Config loading, OS-level sandboxing, event handlers
- **Key patterns**:
  - `pi.registerTool()` with `...localTool` spread
  - `pi.on("session_start", async (event, ctx) => { ... })`
  - `pi.registerFlag()` for extension options
  - `pi.registerCommand()` for slash commands
  - Load config from `~/.pi/agent/extensions/` and `<cwd>/.pi/`

### Skill Extension (dynamic-resources)
- **Pattern**: Markdown-based skill with frontmatter
```markdown
---
name: dynamic-resources
description: Example skill...
---
```

### Extension Entrypoint Pattern
```typescript
export default function (pi: ExtensionAPI) {
  // Register tools, commands, flags, event handlers
  pi.registerTool({ /* ... */ });
  pi.registerCommand("cmd", { /* ... */ });
  pi.on("session_start", async (event, ctx) => { /* ... */ });
}
```

### Package Structure
```
my-extension/
├── package.json       # name: "my-extension", main: "./dist/index.js"
├── tsconfig.json
├── src/
│   └── index.ts    # Entrypoint (named, not just "index" for identity)
├── prompts/           # Optional: prompt templates
│   └── extension.md
└── dist/              # Build output (gitignored)
```

## Important Notes

1. **This is LLM-driven**: Use your understanding to write code and documentation, don't just fill templates
2. **Documentation is key**: The `document` mode provides guidance, but YOU write the actual README.md and ARCHITECTURE.md
3. **External workspace**: Always work in an external directory, not pi's runtime folders
4. **Clean first**: Prioritize simplicity over features
5. **Badges**: Use flat-square style (matching web-search extension)
6. **Personal project disclaimer**: If generating README for this extension-creator, include the disclaimer about no maintenance guarantees

## Example Flow

```
User: "Create an extension that searches the web"

Phase 1: Plan → tool returns "web-search" extension plan
Phase 2: Scaffold → create workspace/web-search/ with package.json, tsconfig.json, src/
Phase 3: Implement → write web-search.ts with search tool
Phase 4: Document → generate README.md (with badges, examples) and ARCHITECTURE.md
Phase 5: Validate → check TypeScript compiles, structure is clean
Phase 6: Review → ensure minimal, no extra commands
Phase 7: Install → pi install ./workspace/web-search
```

## Reference Files

- `prompts/documentation.md` - Detailed documentation generation guide
- `ARCHITECTURE.md` - This project's architecture spec
- https://github.com/Immac/pi-extension-builder - Example of documented extension
