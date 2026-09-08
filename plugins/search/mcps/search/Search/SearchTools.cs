using System.ComponentModel;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
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
        "Search the web with Tavily or Bing and return AI-readable Markdown results. Page enrichment uses GET only."
    )]
    public async Task<string> SearchAsync(
        [Description("Search query.")] string query,
        [Description("Search provider: tavily or bing.")] string provider = "tavily",
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
            "bing" => await SearchBingAsync(query, max_results, cancellationToken),
            _ => throw new ArgumentException("provider must be tavily or bing.", nameof(provider)),
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
        if (string.IsNullOrWhiteSpace(options.Value.TavilyApiKey))
        {
            throw new InvalidOperationException("Tavily is not configured. Set TAVILY_API_KEY.");
        }

        var payload = new
        {
            api_key = options.Value.TavilyApiKey,
            query,
            search_depth = "advanced",
            max_results = maxResults,
            include_answer = true,
            include_raw_content = true,
        };
        using var response = await httpClientFactory
            .CreateClient("tavily")
            .PostAsJsonAsync(options.Value.TavilyEndpoint, payload, cancellationToken);
        response.EnsureSuccessStatusCode();
        var data =
            await response.Content.ReadFromJsonAsync<TavilyResponse>(cancellationToken)
            ?? throw new HttpRequestException("Tavily returned an empty response.");

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

    private async Task<SearchResponse> SearchBingAsync(
        string query,
        int maxResults,
        CancellationToken cancellationToken
    )
    {
        if (string.IsNullOrWhiteSpace(options.Value.BingApiKey))
        {
            throw new InvalidOperationException("Bing is not configured. Set BING_SEARCH_API_KEY.");
        }

        var endpoint =
            $"{options.Value.BingEndpoint}?q={Uri.EscapeDataString(query)}&count={maxResults}&responseFilter=Webpages";
        using var request = new HttpRequestMessage(HttpMethod.Get, endpoint);
        request.Headers.Add("Ocp-Apim-Subscription-Key", options.Value.BingApiKey);
        using var response = await httpClientFactory
            .CreateClient("bing")
            .SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        response.EnsureSuccessStatusCode();
        var data =
            await response.Content.ReadFromJsonAsync<BingResponse>(cancellationToken)
            ?? throw new HttpRequestException("Bing returned an empty response.");

        return new SearchResponse(
            null,
            data.WebPages?.Value.Select(result => new SearchItem(
                    result.Name ?? "Untitled result",
                    result.Url ?? string.Empty,
                    null,
                    result.Snippet
                ))
                .ToList() ?? []
        );
    }

    private sealed record SearchResponse(string? Answer, IReadOnlyList<SearchItem> Items);

    private sealed record SearchItem(string Title, string Url, string? Content, string? Snippet);

    private sealed class TavilyResponse
    {
        [JsonPropertyName("answer")]
        public string? Answer { get; set; }

        [JsonPropertyName("results")]
        public List<TavilyResult> Results { get; set; } = [];
    }

    private sealed class TavilyResult
    {
        [JsonPropertyName("title")]
        public string? Title { get; set; }

        [JsonPropertyName("url")]
        public string? Url { get; set; }

        [JsonPropertyName("content")]
        public string? Content { get; set; }

        [JsonPropertyName("raw_content")]
        public string? RawContent { get; set; }
    }

    private sealed class BingResponse
    {
        [JsonPropertyName("webPages")]
        public BingWebPages? WebPages { get; set; }
    }

    private sealed class BingWebPages
    {
        [JsonPropertyName("value")]
        public List<BingResult> Value { get; set; } = [];
    }

    private sealed class BingResult
    {
        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("url")]
        public string? Url { get; set; }

        [JsonPropertyName("snippet")]
        public string? Snippet { get; set; }
    }
}
