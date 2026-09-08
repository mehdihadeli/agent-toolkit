# Tavily shared SDK

Repository-owned C# client for the Tavily Search and Extract API described by
`https://docs.tavily.com/documentation/api-reference/openapi.json`.

The SDK currently covers:

- `POST /search` through `ITavilyClient.SearchAsync`.
- `POST /extract` through `ITavilyClient.ExtractAsync`.
- `POST /crawl` through `ITavilyClient.CrawlAsync`.
- `POST /map` through `ITavilyClient.MapAsync`.
- `POST /research` and `GET /research/{request_id}` through
  `ResearchAsync` and `GetResearchAsync`.
- `GetSearchContextAsync` and `QnaSearchAsync` convenience operations backed by
  Search.
- `AsSearchTool()` and `AsExtractTool()` Microsoft.Extensions.AI
  `AIFunction` wrappers.

The client sends the API key as a bearer token and defaults to Tavily's
OpenAPI server, `https://api.tavily.com/`. Supply an `HttpClient` with a
custom base address when needed.

When no key is passed, the client resolves `TAVILY_API_KEY` from the process
environment and then from `.env` files starting at the current directory and
walking up its parents. Explicit constructor values take precedence over both.
Keep `.env` at the application or repository root, outside this shared folder,
and add it to `.gitignore`.

Example:

```csharp
using AgentSkillsMcp.Tavily;
using Microsoft.Extensions.AI;

var client = new TavilyClient(httpClient, tavilyApiKey);
AIFunction searchTool = client.AsSearchTool();
AIFunction extractTool = client.AsExtractTool();
```

Automatic local development resolution:

```csharp
var client = new TavilyClient(httpClient);
```

Example root `.env`:

```text
TAVILY_API_KEY=your-tavily-key
```

## Live integration tests

The live suite exercises every supported endpoint against Tavily and requires a
real key. Run it explicitly so ordinary test runs do not spend API credits:

```bash
TAVILY_RUN_LIVE_TESTS=1 dotnet test --project \
  tests/search/integration-tests/AgentSkillsMcp.Search.IntegrationTests.csproj \
  --filter-class AgentSkillsMcp.Search.Tests.TavilySdkIntegrationTests
```

The suite resolves `TAVILY_API_KEY` from the environment or the repository
`.env` file. Crawl, Map, and Research use small bounded requests.
