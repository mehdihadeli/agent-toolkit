using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace AgentSkillsMcp.Tavily;

public interface ITavilyClient
{
    Task<TavilySearchResponse> SearchAsync(
        TavilySearchRequest request,
        CancellationToken cancellationToken = default
    );

    Task<TavilyExtractResponse> ExtractAsync(
        TavilyExtractRequest request,
        CancellationToken cancellationToken = default
    );

    Task<TavilyCrawlResponse> CrawlAsync(
        TavilyCrawlRequest request,
        CancellationToken cancellationToken = default
    );

    Task<TavilyMapResponse> MapAsync(
        TavilyMapRequest request,
        CancellationToken cancellationToken = default
    );

    Task<TavilyResearchResponse> ResearchAsync(
        TavilyResearchRequest request,
        CancellationToken cancellationToken = default
    );

    Task<TavilyResearchResponse> GetResearchAsync(
        string requestId,
        CancellationToken cancellationToken = default
    );

    Task<string> GetSearchContextAsync(
        TavilySearchContextRequest request,
        int maxCharacters = 16_000,
        CancellationToken cancellationToken = default
    );

    Task<string?> QnaSearchAsync(string query, CancellationToken cancellationToken = default);
}

public sealed class TavilyClient : ITavilyClient
{
    private static readonly JsonSerializerOptions JsonOptions =
        new(JsonSerializerDefaults.Web)
        {
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        };
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;

    public TavilyClient(HttpClient httpClient, string? apiKey = null, string? envFilePath = null)
    {
        ArgumentNullException.ThrowIfNull(httpClient);
        if (apiKey is not null && string.IsNullOrWhiteSpace(apiKey))
        {
            throw new MissingApiKeyException();
        }

        _httpClient = httpClient;
        _httpClient.BaseAddress ??= new Uri("https://api.tavily.com/", UriKind.Absolute);
        _apiKey =
            TavilyApiKeyResolver.Resolve(apiKey, envFilePath) ?? throw new MissingApiKeyException();
    }

    public Task<TavilySearchResponse> SearchAsync(
        TavilySearchRequest request,
        CancellationToken cancellationToken = default
    ) => PostAsync<TavilySearchRequest, TavilySearchResponse>("search", request, cancellationToken);

    public Task<TavilyExtractResponse> ExtractAsync(
        TavilyExtractRequest request,
        CancellationToken cancellationToken = default
    ) =>
        PostAsync<TavilyExtractRequest, TavilyExtractResponse>(
            "extract",
            request,
            cancellationToken
        );

    public Task<TavilyCrawlResponse> CrawlAsync(
        TavilyCrawlRequest request,
        CancellationToken cancellationToken = default
    ) => PostAsync<TavilyCrawlRequest, TavilyCrawlResponse>("crawl", request, cancellationToken);

    public Task<TavilyMapResponse> MapAsync(
        TavilyMapRequest request,
        CancellationToken cancellationToken = default
    ) => PostAsync<TavilyMapRequest, TavilyMapResponse>("map", request, cancellationToken);

    public Task<TavilyResearchResponse> ResearchAsync(
        TavilyResearchRequest request,
        CancellationToken cancellationToken = default
    ) =>
        PostAsync<TavilyResearchRequest, TavilyResearchResponse>(
            "research",
            request,
            cancellationToken
        );

    public Task<TavilyResearchResponse> GetResearchAsync(
        string requestId,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(requestId);
        return GetAsync<TavilyResearchResponse>(
            $"research/{Uri.EscapeDataString(requestId)}",
            cancellationToken
        );
    }

    public async Task<string> GetSearchContextAsync(
        TavilySearchContextRequest request,
        int maxCharacters = 16_000,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(maxCharacters);
        var response = await SearchAsync(
                new TavilySearchRequest
                {
                    Query = request.Query,
                    SearchDepth = request.SearchDepth,
                    MaxResults = request.MaxResults,
                    IncludeAnswer = false,
                    IncludeRawContent = false,
                    Topic = request.Topic,
                    Days = request.Days,
                    IncludeDomains = request.IncludeDomains,
                    ExcludeDomains = request.ExcludeDomains,
                },
                cancellationToken
            )
            .ConfigureAwait(false);

        var context = JsonSerializer.Serialize(
            response.Results.Select(result => new { result.Url, result.Content }),
            JsonOptions
        );
        return context.Length <= maxCharacters ? context : context[..maxCharacters];
    }

    public async Task<string?> QnaSearchAsync(
        string query,
        CancellationToken cancellationToken = default
    )
    {
        var response = await SearchAsync(
                new TavilySearchRequest
                {
                    Query = query,
                    SearchDepth = "advanced",
                    IncludeAnswer = true,
                    IncludeRawContent = false,
                },
                cancellationToken
            )
            .ConfigureAwait(false);
        return response.Answer;
    }

    private async Task<TResponse> PostAsync<TRequest, TResponse>(
        string path,
        TRequest request,
        CancellationToken cancellationToken
    )
    {
        using var message = new HttpRequestMessage(HttpMethod.Post, path);
        message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
        message.Content = JsonContent.Create(request, options: JsonOptions);

        HttpResponseMessage response;
        try
        {
            response = await _httpClient
                .SendAsync(message, HttpCompletionOption.ResponseHeadersRead, cancellationToken)
                .ConfigureAwait(false);
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new TavilyTimeoutException(_httpClient.Timeout);
        }

        using (response)
        {
            if (!response.IsSuccessStatusCode)
            {
                await ThrowForErrorAsync(response, path, cancellationToken).ConfigureAwait(false);
            }

            return await response.Content.ReadFromJsonAsync<TResponse>(
                    JsonOptions,
                    cancellationToken
                ) ?? throw new HttpRequestException($"Tavily returned an empty {path} response.");
        }
    }

    private async Task<TResponse> GetAsync<TResponse>(
        string path,
        CancellationToken cancellationToken
    )
    {
        using var message = new HttpRequestMessage(HttpMethod.Get, path);
        message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);

        HttpResponseMessage response;
        try
        {
            response = await _httpClient
                .SendAsync(message, HttpCompletionOption.ResponseHeadersRead, cancellationToken)
                .ConfigureAwait(false);
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new TavilyTimeoutException(_httpClient.Timeout);
        }

        using (response)
        {
            if (!response.IsSuccessStatusCode)
            {
                await ThrowForErrorAsync(response, path, cancellationToken).ConfigureAwait(false);
            }

            return await response.Content.ReadFromJsonAsync<TResponse>(
                    JsonOptions,
                    cancellationToken
                ) ?? throw new HttpRequestException($"Tavily returned an empty {path} response.");
        }
    }

    private static async Task ThrowForErrorAsync(
        HttpResponseMessage response,
        string path,
        CancellationToken cancellationToken
    )
    {
        var body = await response
            .Content.ReadAsStringAsync(cancellationToken)
            .ConfigureAwait(false);
        using var document = TryParse(body);

        if (
            document?.RootElement.TryGetProperty("error", out var error) == true
            && error.ValueKind == JsonValueKind.Object
            && error.TryGetProperty("code", out var code)
            && code.ValueKind == JsonValueKind.String
        )
        {
            var nextActions =
                error.TryGetProperty("next_actions", out var actions)
                && actions.ValueKind == JsonValueKind.Array
                    ? actions.EnumerateArray().Select(static item => item.Clone()).ToArray()
                    : [];

            throw new TavilyKeylessLimitException(
                GetString(error, "message") ?? "Tavily keyless usage limit exceeded.",
                code.GetString(),
                GetString(error, "window"),
                GetInt32(error, "retry_after_seconds"),
                nextActions
            );
        }

        var detail =
            document?.RootElement.TryGetProperty("detail", out var detailElement) == true
                ? detailElement
                : default;
        var message =
            detail.ValueKind == JsonValueKind.Object ? GetString(detail, "error")
            : detail.ValueKind == JsonValueKind.String ? detail.GetString()
            : null;
        message ??= string.IsNullOrWhiteSpace(body)
            ? $"Tavily {path} request failed with HTTP {(int)response.StatusCode}."
            : body;

        throw response.StatusCode switch
        {
            System.Net.HttpStatusCode.BadRequest => new BadRequestException(message),
            System.Net.HttpStatusCode.Unauthorized => new InvalidApiKeyException(message),
            System.Net.HttpStatusCode.Forbidden => new ForbiddenException(message),
            (System.Net.HttpStatusCode)432 => new ForbiddenException(message),
            (System.Net.HttpStatusCode)433 => new ForbiddenException(message),
            System.Net.HttpStatusCode.TooManyRequests => new UsageLimitExceededException(message),
            _ => new HttpRequestException(message, null, response.StatusCode),
        };
    }

    private static JsonDocument? TryParse(string body)
    {
        try
        {
            return JsonDocument.Parse(body);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string? GetString(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var value)
        && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static int? GetInt32(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var value) && value.TryGetInt32(out var result)
            ? result
            : null;
}
