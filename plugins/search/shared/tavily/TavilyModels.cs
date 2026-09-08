using System.Text.Json;
using System.Text.Json.Serialization;

namespace AgentSkillsMcp.Tavily;

public sealed class TavilySearchRequest
{
    [JsonPropertyName("query")]
    public required string Query { get; init; }

    [JsonPropertyName("search_depth")]
    public string SearchDepth { get; init; } = "advanced";

    [JsonPropertyName("max_results")]
    public int MaxResults { get; init; } = 5;

    [JsonPropertyName("include_answer")]
    public bool IncludeAnswer { get; init; } = true;

    [JsonPropertyName("include_raw_content")]
    public bool IncludeRawContent { get; init; } = true;

    [JsonPropertyName("topic")]
    public string? Topic { get; init; }

    [JsonPropertyName("time_range")]
    public string? TimeRange { get; init; }

    [JsonPropertyName("start_date")]
    public string? StartDate { get; init; }

    [JsonPropertyName("end_date")]
    public string? EndDate { get; init; }

    [JsonPropertyName("days")]
    public int? Days { get; init; }

    [JsonPropertyName("include_domains")]
    public IReadOnlyList<string>? IncludeDomains { get; init; }

    [JsonPropertyName("exclude_domains")]
    public IReadOnlyList<string>? ExcludeDomains { get; init; }

    [JsonPropertyName("include_domains_mode")]
    public string? IncludeDomainsMode { get; init; }

    [JsonPropertyName("include_images")]
    public bool IncludeImages { get; init; }

    [JsonPropertyName("include_image_descriptions")]
    public bool IncludeImageDescriptions { get; init; }

    [JsonPropertyName("include_favicon")]
    public bool IncludeFavicon { get; init; }

    [JsonPropertyName("country")]
    public string? Country { get; init; }

    [JsonPropertyName("language")]
    public string? Language { get; init; }

    [JsonPropertyName("filter_by_language")]
    public bool FilterByLanguage { get; init; }

    [JsonPropertyName("auto_parameters")]
    public bool AutoParameters { get; init; }

    [JsonPropertyName("exact_match")]
    public bool ExactMatch { get; init; }

    [JsonPropertyName("include_usage")]
    public bool IncludeUsage { get; init; }

    [JsonPropertyName("safe_search")]
    public bool SafeSearch { get; init; }

    [JsonPropertyName("chunks_per_source")]
    public int? ChunksPerSource { get; init; }
}

public sealed class TavilySearchResponse
{
    [JsonPropertyName("query")]
    public string? Query { get; init; }

    [JsonPropertyName("answer")]
    public string? Answer { get; init; }

    [JsonPropertyName("results")]
    public IReadOnlyList<TavilySearchResult> Results { get; init; } = [];

    [JsonPropertyName("images")]
    public IReadOnlyList<TavilyImage> Images { get; init; } = [];

    [JsonPropertyName("response_time")]
    public double? ResponseTime { get; init; }

    [JsonPropertyName("usage")]
    public TavilyUsageMetrics? Usage { get; init; }

    [JsonPropertyName("request_id")]
    public string? RequestId { get; init; }
}

public sealed class TavilySearchResult
{
    [JsonPropertyName("title")]
    public string? Title { get; init; }

    [JsonPropertyName("url")]
    public string? Url { get; init; }

    [JsonPropertyName("content")]
    public string? Content { get; init; }

    [JsonPropertyName("raw_content")]
    public string? RawContent { get; init; }

    [JsonPropertyName("score")]
    public double? Score { get; init; }

    [JsonPropertyName("favicon")]
    public string? Favicon { get; init; }

    [JsonPropertyName("images")]
    public IReadOnlyList<TavilyImage> Images { get; init; } = [];

    [JsonPropertyName("id")]
    public string? Id { get; init; }
}

public sealed class TavilyImage
{
    [JsonPropertyName("url")]
    public string? Url { get; init; }

    [JsonPropertyName("description")]
    public string? Description { get; init; }
}

public sealed class TavilyExtractRequest
{
    [JsonPropertyName("urls")]
    public required IReadOnlyList<string> Urls { get; init; }

    [JsonPropertyName("query")]
    public string? Query { get; init; }

    [JsonPropertyName("extract_depth")]
    public string ExtractDepth { get; init; } = "basic";

    [JsonPropertyName("format")]
    public string Format { get; init; } = "markdown";

    [JsonPropertyName("include_images")]
    public bool IncludeImages { get; init; }

    [JsonPropertyName("include_favicon")]
    public bool IncludeFavicon { get; init; }

    [JsonPropertyName("include_usage")]
    public bool IncludeUsage { get; init; }

    [JsonPropertyName("chunks_per_source")]
    public int? ChunksPerSource { get; init; }
}

public sealed class TavilyExtractResponse
{
    [JsonPropertyName("results")]
    public IReadOnlyList<TavilyExtractResult> Results { get; init; } = [];

    [JsonPropertyName("failed_results")]
    public IReadOnlyList<TavilyExtractFailure> FailedResults { get; init; } = [];

    [JsonPropertyName("response_time")]
    public double? ResponseTime { get; init; }

    [JsonPropertyName("usage")]
    public TavilyUsageMetrics? Usage { get; init; }

    [JsonPropertyName("request_id")]
    public string? RequestId { get; init; }
}

public sealed class TavilyExtractResult
{
    [JsonPropertyName("url")]
    public string? Url { get; init; }

    [JsonPropertyName("raw_content")]
    public string? RawContent { get; init; }

    [JsonPropertyName("images")]
    public IReadOnlyList<string> Images { get; init; } = [];

    [JsonPropertyName("favicon")]
    public string? Favicon { get; init; }
}

public sealed class TavilyExtractFailure
{
    [JsonPropertyName("url")]
    public string? Url { get; init; }

    [JsonPropertyName("error")]
    public string? Error { get; init; }
}

public sealed class TavilyCrawlRequest
{
    [JsonPropertyName("url")]
    public required string Url { get; init; }

    [JsonPropertyName("instructions")]
    public string? Instructions { get; init; }

    [JsonPropertyName("max_depth")]
    public int? MaxDepth { get; init; }

    [JsonPropertyName("max_breadth")]
    public int? MaxBreadth { get; init; }

    [JsonPropertyName("limit")]
    public int? Limit { get; init; }

    [JsonPropertyName("select_paths")]
    public IReadOnlyList<string>? SelectPaths { get; init; }

    [JsonPropertyName("select_domains")]
    public IReadOnlyList<string>? SelectDomains { get; init; }

    [JsonPropertyName("exclude_paths")]
    public IReadOnlyList<string>? ExcludePaths { get; init; }

    [JsonPropertyName("exclude_domains")]
    public IReadOnlyList<string>? ExcludeDomains { get; init; }

    [JsonPropertyName("allow_external")]
    public bool? AllowExternal { get; init; }

    [JsonPropertyName("include_images")]
    public bool IncludeImages { get; init; }

    [JsonPropertyName("extract_depth")]
    public string? ExtractDepth { get; init; }

    [JsonPropertyName("format")]
    public string? Format { get; init; }

    [JsonPropertyName("include_favicon")]
    public bool IncludeFavicon { get; init; }

    [JsonPropertyName("include_usage")]
    public bool IncludeUsage { get; init; }

    [JsonPropertyName("chunks_per_source")]
    public int? ChunksPerSource { get; init; }
}

public sealed class TavilyCrawlResponse
{
    [JsonPropertyName("base_url")]
    public string? BaseUrl { get; init; }

    [JsonPropertyName("results")]
    public IReadOnlyList<TavilyExtractResult> Results { get; init; } = [];

    [JsonPropertyName("response_time")]
    public double? ResponseTime { get; init; }

    [JsonPropertyName("usage")]
    public TavilyUsageMetrics? Usage { get; init; }

    [JsonPropertyName("request_id")]
    public string? RequestId { get; init; }
}

public sealed class TavilyMapRequest
{
    [JsonPropertyName("url")]
    public required string Url { get; init; }

    [JsonPropertyName("instructions")]
    public string? Instructions { get; init; }

    [JsonPropertyName("max_depth")]
    public int? MaxDepth { get; init; }

    [JsonPropertyName("max_breadth")]
    public int? MaxBreadth { get; init; }

    [JsonPropertyName("limit")]
    public int? Limit { get; init; }

    [JsonPropertyName("select_paths")]
    public IReadOnlyList<string>? SelectPaths { get; init; }

    [JsonPropertyName("select_domains")]
    public IReadOnlyList<string>? SelectDomains { get; init; }

    [JsonPropertyName("exclude_paths")]
    public IReadOnlyList<string>? ExcludePaths { get; init; }

    [JsonPropertyName("exclude_domains")]
    public IReadOnlyList<string>? ExcludeDomains { get; init; }

    [JsonPropertyName("allow_external")]
    public bool? AllowExternal { get; init; }

    [JsonPropertyName("include_usage")]
    public bool IncludeUsage { get; init; }
}

public sealed class TavilyMapResponse
{
    [JsonPropertyName("base_url")]
    public string? BaseUrl { get; init; }

    [JsonPropertyName("results")]
    public IReadOnlyList<string> Results { get; init; } = [];

    [JsonPropertyName("response_time")]
    public double? ResponseTime { get; init; }

    [JsonPropertyName("usage")]
    public TavilyUsageMetrics? Usage { get; init; }

    [JsonPropertyName("request_id")]
    public string? RequestId { get; init; }
}

public sealed class TavilyResearchRequest
{
    [JsonPropertyName("input")]
    public required string Input { get; init; }

    [JsonPropertyName("model")]
    public string? Model { get; init; }

    [JsonPropertyName("output_schema")]
    public object? OutputSchema { get; init; }

    [JsonPropertyName("stream")]
    public bool Stream { get; init; }

    [JsonPropertyName("citation_format")]
    public string CitationFormat { get; init; } = "numbered";

    [JsonPropertyName("include_domains")]
    public IReadOnlyList<string>? IncludeDomains { get; init; }

    [JsonPropertyName("exclude_domains")]
    public IReadOnlyList<string>? ExcludeDomains { get; init; }

    [JsonPropertyName("output_length")]
    public string? OutputLength { get; init; }

    [JsonPropertyName("files")]
    public IReadOnlyList<TavilyResearchFile>? Files { get; init; }
}

public sealed class TavilyResearchFile
{
    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("data")]
    public required string Data { get; init; }

    [JsonPropertyName("type")]
    public string Type { get; init; } = "base64";
}

public sealed class TavilyResearchResponse
{
    [JsonPropertyName("request_id")]
    public string? RequestId { get; init; }

    [JsonPropertyName("created_at")]
    public string? CreatedAt { get; init; }

    [JsonPropertyName("completed_at")]
    public string? CompletedAt { get; init; }

    [JsonPropertyName("status")]
    public string? Status { get; init; }

    [JsonPropertyName("input")]
    public string? Input { get; init; }

    [JsonPropertyName("model")]
    public string? Model { get; init; }

    [JsonPropertyName("content")]
    public JsonElement? Content { get; init; }

    [JsonPropertyName("sources")]
    public IReadOnlyList<TavilyResearchSource> Sources { get; init; } = [];

    [JsonPropertyName("response_time")]
    public double? ResponseTime { get; init; }
}

public sealed class TavilyResearchSource
{
    [JsonPropertyName("title")]
    public string? Title { get; init; }

    [JsonPropertyName("url")]
    public string? Url { get; init; }

    [JsonPropertyName("favicon")]
    public string? Favicon { get; init; }
}

public sealed class TavilyUsageMetrics
{
    [JsonPropertyName("credits")]
    public double? Credits { get; init; }
}

public sealed class TavilySearchContextRequest
{
    [JsonPropertyName("query")]
    public required string Query { get; init; }

    [JsonPropertyName("search_depth")]
    public string SearchDepth { get; init; } = "basic";

    [JsonPropertyName("topic")]
    public string Topic { get; init; } = "general";

    [JsonPropertyName("days")]
    public int Days { get; init; } = 7;

    [JsonPropertyName("max_results")]
    public int MaxResults { get; init; } = 5;

    [JsonPropertyName("include_domains")]
    public IReadOnlyList<string>? IncludeDomains { get; init; }

    [JsonPropertyName("exclude_domains")]
    public IReadOnlyList<string>? ExcludeDomains { get; init; }
}
