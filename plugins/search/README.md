# Agent Toolkit Search Plugin

Stateless Streamable HTTP MCP server for web retrieval and cited research. The application targets .NET 10, uses the official MCP C# SDK, and optionally synthesizes research with Microsoft Agent Framework.

## Tools

### `fetch`

Fetch one public HTTP or HTTPS URL.

Parameters:

- `url`: absolute public URL.
- `format`: `raw`, `text`, `markdown`, or `readable`; defaults to `raw`.
- `max_length`: maximum returned characters, from 1 to 50,000; defaults to 50,000.
- `start_index`: character offset for continuing a truncated response; defaults to 0.

`markdown` converts common HTML structure such as headings, paragraphs, lists, and links to Markdown. `readable` removes scripts, styles, tags, comments, and excess whitespace for article-like text.

### `crawl`

Bounded same-origin crawl returning Markdown.

- `url`: starting public URL.
- `max_pages`: 1 to 20 pages; defaults to 5.
- `max_depth`: 0 to 3 link depth; defaults to 1.

Crawl deduplicates URLs, stays on the starting origin, follows Markdown links, and checks `/robots.txt` before visiting pages. Missing or unavailable robots metadata allows crawling; matching `User-agent: *` `Disallow` rules block paths.

### `search`

Search with `tavily` or `bing` and return Markdown containing titles, source links, snippets/raw content, and optional fetched page content.

- `query`: non-empty search query.
- `provider`: `tavily` or `bing`; defaults to `tavily`.
- `max_results`: 1 to 10; defaults to 5.
- `fetch_results`: fetch result pages as readable content; defaults to `true`.

### `discover_llms_txt`

Checks and fetches `/llms.txt`, then `/.well-known/llms.txt`, returning Markdown. Requests use the same public-URL validation and GET-only fetch path.

### `research`

Searches the web, enriches results, and returns cited Markdown. When `OPENAI_API_KEY` is configured, Microsoft Agent Framework synthesizes the source dossier; otherwise the dossier is returned deterministically.

## Read-only and security behavior

- Target pages, redirects, crawled pages, robots files, and `llms.txt` are requested with HTTP `GET` only.
- The fetch tool exposes no arbitrary HTTP method and never sends target-site `POST`, `PUT`, `PATCH`, or `DELETE` requests.
- Localhost, loopback, private IPv4, link-local, unspecified, and credential-bearing URLs are rejected.
- Redirects are validated and limited to five hops.
- Responses are limited to 10 MiB and HTTP clients time out after 30 seconds.
- Crawl is same-origin and bounded by page/depth limits.

The MCP Streamable HTTP protocol itself may use its protocol-defined requests. Tavily's official search API requires an internal `POST`; this only calls Tavily's API and is not a page fetch.

Tavily integration is implemented by the shared SDK in
`shared/tavily/AgentSkillsMcp.Tavily.csproj`, based on Tavily's OpenAPI
specification. It provides typed Search and Extract operations plus
`Microsoft.Extensions.AI` `AIFunction` wrappers.

## Configuration

Set provider credentials through environment variables. Do not commit keys to source control.

```text
Search__EnableTavily=false
TAVILY_API_KEY=your-tavily-key
```

Tavily is disabled by default. Set `Search__EnableTavily=true` before using its
API key. The GitHub Actions workflow maps repository variable
`ENABLE_TAVILY_SEARCH` to this option.

## Local development

```bash
dotnet run --project AgentSkillsMcp.Search.csproj
```

Connect an MCP client to the local HTTP endpoint:

```json
{
  "mcpServers": {
    "agent-toolkit-search": {
      "type": "http",
      "url": "http://localhost:6243"
    }
  }
}
```

## Docker

The dedicated [Dockerfile](mcps/search/Dockerfile) uses an architecture-aware multi-stage .NET build, cached restore/publish layers, the ASP.NET runtime image, and the non-root `$APP_UID` user.

```bash
docker build -f mcps/search/Dockerfile -t agent-toolkit-mcp-fetch .
docker run --rm -p 8080:8080 \
  -e TAVILY_API_KEY \
  agent-toolkit-mcp-fetch
```

The MCP endpoint is available at `http://localhost:8080`.

## Development validation

```bash
dotnet build AgentSkillsMcp.Search.csproj
dotnet test ../../../tests/search/unit-tests/AgentSkillsMcp.Search.Tests.csproj
dotnet test ../../../tests/search/integration-tests/AgentSkillsMcp.Search.IntegrationTests.csproj
```

Tests use xUnit v3, Microsoft Testing Platform, and Shouldly.

## More information

ASP.NET Core MCP servers use the [ModelContextProtocol.AspNetCore](https://www.nuget.org/packages/ModelContextProtocol.AspNetCore) package from the MCP C# SDK. For more information about MCP:

- [Official Documentation](https://modelcontextprotocol.io/)
- [Protocol Specification](https://spec.modelcontextprotocol.io/)
- [GitHub Organization](https://github.com/modelcontextprotocol)
- [MCP C# SDK](https://csharp.sdk.modelcontextprotocol.io/)
