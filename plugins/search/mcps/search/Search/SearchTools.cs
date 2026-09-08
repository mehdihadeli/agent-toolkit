using System.ComponentModel;
using AgentSkillsMcp.Tavily;
using Microsoft.Extensions.Options;
using ModelContextProtocol.Server;

public sealed class SearchTools(
    IHttpClientFactory httpClientFactory,
    IOptions<SearchOptions> options,
    FetchTools fetchTools
)
{
    [McpServerTool(Name = "search")]
    [Description(
        "Search the web with Tavily and return AI-readable Markdown results. Page enrichment uses GET only."
    )]
    public async Task<string> SearchAsync(
        [Description("Search query.")] string query,
        [Description("Search provider: tavily.")] string provider = "tavily",
        [Description("Maximum results, from 1 to 10.")] int max_results = 5,
        [Description("Fetch each result and include readable Markdown content.")]
            bool fetch_results = true,
        CancellationToken cancellationToken = default
    )
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            throw new ArgumentException("query cannot be empty.", nameof(query));
        }

        if (max_results is < 1 or > 10)
        {
            throw new ArgumentOutOfRangeException(
                nameof(max_results),
                "max_results must be between 1 and 10."
            );
        }

        var normalizedProvider = provider.Trim().ToLowerInvariant();
        var results = normalizedProvider switch
        {
            "tavily" => await SearchTavilyAsync(query, max_results, cancellationToken),
            _ => throw new ArgumentException("provider must be tavily.", nameof(provider)),
        };

        var output = new System.Text.StringBuilder($"# Web search: {query}\n\n");
        if (results.Answer is not null)
        {
            output.AppendLine($"**Answer:** {results.Answer}");
            output.AppendLine();
        }

        foreach (var result in results.Items)
        {
            output.AppendLine($"## {result.Title}");
            output.AppendLine($"Source: [{result.Url}]({result.Url})");
            if (!string.IsNullOrWhiteSpace(result.Content))
            {
                output.AppendLine();
                output.AppendLine(result.Content);
            }
            else if (!string.IsNullOrWhiteSpace(result.Snippet))
            {
                output.AppendLine();
                output.AppendLine(result.Snippet);
            }

            if (fetch_results && Uri.TryCreate(result.Url, UriKind.Absolute, out _))
            {
                try
                {
                    var fetched = await fetchTools.FetchAsync(
                        result.Url,
                        format: "readable",
                        max_length: 8_000,
                        cancellationToken: cancellationToken
                    );
                    output.AppendLine();
                    output.AppendLine("### Page content");
                    output.AppendLine(fetched);
                }
                catch (HttpRequestException)
                {
                    output.AppendLine("\nPage content unavailable.");
                }
                catch (ArgumentException)
                {
                    output.AppendLine("\nPage content unavailable.");
                }
            }

            output.AppendLine();
        }

        return output.ToString().TrimEnd();
    }

    private async Task<SearchResponse> SearchTavilyAsync(
        string query,
        int maxResults,
        CancellationToken cancellationToken
    )
    {
        if (!options.Value.EnableTavily)
        {
            throw new InvalidOperationException(
                "Tavily search is disabled. Set Search:EnableTavily to true."
            );
        }

        if (string.IsNullOrWhiteSpace(options.Value.TavilyApiKey))
        {
            throw new InvalidOperationException("Tavily is not configured. Set TAVILY_API_KEY.");
        }

        var client = new TavilyClient(
            httpClientFactory.CreateClient("tavily"),
            options.Value.TavilyApiKey
        );
        var data = await client.SearchAsync(
            new TavilySearchRequest
            {
                Query = query,
                MaxResults = maxResults,
                SearchDepth = "advanced",
                IncludeAnswer = true,
                IncludeRawContent = true,
            },
            cancellationToken
        );

        return new SearchResponse(
            data.Answer,
            data.Results.Select(result => new SearchItem(
                    result.Title ?? "Untitled result",
                    result.Url ?? string.Empty,
                    result.RawContent ?? result.Content,
                    null
                ))
                .ToList()
        );
    }

    private sealed record SearchResponse(string? Answer, IReadOnlyList<SearchItem> Items);

    private sealed record SearchItem(string Title, string Url, string? Content, string? Snippet);
}
