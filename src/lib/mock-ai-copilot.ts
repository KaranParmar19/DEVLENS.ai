/**
 * DevLens AI — Mock Copilot Response Generator
 * Provides realistic, intelligent architectural responses for offline/demo mode
 * with file citation sources that can be clicked to inspect and focus nodes.
 */

export interface CopilotResponse {
  reply: string;
  sources: string[];
}

export function getSimulatedCopilotResponse(query: string, repoLabel: string = "repository"): CopilotResponse {
  const q = query.toLowerCase();

  if (q.includes("delete") || q.includes("break") || q.includes("remove") || q.includes("router")) {
    return {
      reply: `Deleting or modifying \`src/router/Router.tsx\` triggers high blast radius breakage across **3 downstream layers** in ${repoLabel}:

1. **Ingress Entry Point (\`src/App.tsx\`)**:
   Directly mounts the application route table. Without it, viewport hydration fails and displays a blank boundary.

2. **Auth Service Route Guards (\`src/services/AuthService.ts\`)**:
   Monitors path navigation hooks to enforce bearer token authorization prior to route mounting.

3. **API Client Invalidation (\`src/lib/ApiClient.ts\`)**:
   Synchronizes query string tokens and abort controllers with active route state.

**Blast Radius Assessment**: **HIGH (84% impact score)**
**Recommendation**: Decouple route configuration into individual route modules before refactoring or removing this hub.`,
      sources: ["src/router/Router.tsx", "src/App.tsx", "src/services/AuthService.ts"],
    };
  }

  if (q.includes("auth") || q.includes("login") || q.includes("token") || q.includes("session")) {
    return {
      reply: `The authentication architecture in ${repoLabel} operates via a 3-stage lifecycle:

1. **Credential Check & Ingress**:
   \`src/services/AuthService.ts\` queries secure storage for active sessions. If expired, it initiates an OAuth redirect.

2. **HTTP Middleware Injection**:
   \`src/lib/ApiClient.ts\` acts as the transport layer, intercepting all outgoing requests to inject \`Authorization: Bearer <token>\` and handles automatic 401 retry loops.

3. **Global State Synchronization**:
   \`src/store/Store.ts\` retains user identity, scopes, and dispatches reactive events to child components.

**Security Health**: Clean separation between credential acquisition and HTTP transport. Token rotation is centralized in \`AuthService.ts\`.`,
      sources: ["src/services/AuthService.ts", "src/lib/ApiClient.ts", "src/store/Store.ts"],
    };
  }

  if (q.includes("circular") || q.includes("cycle") || q.includes("loop")) {
    return {
      reply: `**Static Architectural Audit: 0 Circular Cycles Detected.**

The repository follows a clean Directed Acyclic Graph (DAG) pattern:
- **Presentation Layer**: \`src/App.tsx\` → \`src/router/Router.tsx\`
- **Service Layer**: \`src/services/AuthService.ts\`, \`src/lib/ApiClient.ts\`
- **State Management**: \`src/store/Store.ts\`
- **Persistence**: \`src/db/Database.ts\`

All dependency arrows flow strictly downward toward persistence. The highest fan-out node is \`Store.ts\` (14 downstream callers), but coupling remains acyclic.`,
      sources: ["src/store/Store.ts", "src/db/Database.ts"],
    };
  }

  if (q.includes("blast radius") || q.includes("impact") || q.includes("apiclient")) {
    return {
      reply: `**Blast Radius Analysis for \`src/lib/ApiClient.ts\`**:

- **Direct Callers**: 4 modules (\`Store.ts\`, \`Router.tsx\`, \`AuthService.ts\`, \`Formatters.ts\`)
- **Transitive Callers**: 9 files across the codebase
- **Coupling Coefficient**: 22 / 50 (Moderate)
- **Downstream Consequence**:
  Any changes to response envelope parsing or error throwing in \`ApiClient.ts\` will propagate directly into data fetching in \`Store.ts\` and auth session refresh in \`AuthService.ts\`.

**Safety Advice**: Introduce TypeScript response schemas or mock contracts prior to making breaking changes.`,
      sources: ["src/lib/ApiClient.ts", "src/store/Store.ts", "src/services/AuthService.ts"],
    };
  }

  // Check if a specific file name was asked about
  const fileKeywords = [
    { name: "AuthService", path: "src/services/AuthService.ts" },
    { name: "ApiClient", path: "src/lib/ApiClient.ts" },
    { name: "Router", path: "src/router/Router.tsx" },
    { name: "Store", path: "src/store/Store.ts" },
    { name: "Database", path: "src/db/Database.ts" },
    { name: "Formatters", path: "src/utils/Formatters.ts" },
    { name: "App", path: "src/App.tsx" },
  ];

  const matched = fileKeywords.find(f => q.includes(f.name.toLowerCase()));
  if (matched) {
    return {
      reply: `**Component Inspection: \`${matched.path}\`**

- **Role**: Core architectural building block handling specialized domain operations.
- **Upstream Dependencies**: Ingested by top-level state management and route controllers.
- **Downstream Consumers**: Consumes foundational helpers and storage drivers.
- **Architectural Health**:
  - Cyclomatic Complexity: Normal
  - Fan-in: Moderate
  - Test Coverage: Tracked in CI/CD pipeline

Click the citation below to inspect the AST structure and blast radius on the canvas.`,
      sources: [matched.path],
    };
  }

  // Default general intelligence response
  return {
    reply: `Based on the AST knowledge graph of **${repoLabel}**:

- The codebase is structured around modular domain boundaries with clear ingress controllers.
- Data fetching flows through \`src/lib/ApiClient.ts\` and hydrates the centralized state container in \`src/store/Store.ts\`.
- Core services like \`src/services/AuthService.ts\` provide business logic encapsulation.

You can click any citation pill below or ask targeted questions such as:
- *"What breaks if I delete router.ts?"*
- *"Explain the auth flow"*
- *"Where are the circular dependencies?"*`,
    sources: ["src/App.tsx", "src/services/AuthService.ts", "src/store/Store.ts"],
  };
}
