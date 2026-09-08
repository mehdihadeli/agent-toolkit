using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AgentSkillsMcp.Tavily;
using Microsoft.Extensions.AI;
using Shouldly;
using Xunit;

public sealed class TavilySdkTests
{
    [Fact]
    public async Task Search_posts_openapi_request_with_bearer_authentication()
    {
        using var client = CreateClient(
            "{\"query\":\"dotnet\",\"answer\":\"answer\",\"results\":[{\"title\":\"Docs\",\"url\":\"https://example.com\",\"content\":\"content\"}]}",
            request =>
            {
                request.Method.ShouldBe(HttpMethod.Post);
                request.RequestUri!.PathAndQuery.ShouldBe("/search");
                request.Headers.Authorization!.Scheme.ShouldBe("Bearer");
                request.Headers.Authorization.Parameter.ShouldBe("test-key");
                return Task.CompletedTask;
            }
        );
        var tavily = new TavilyClient(client, "test-key");

        var response = await tavily.SearchAsync(
            new TavilySearchRequest { Query = "dotnet", MaxResults = 1 },
            TestContext.Current.CancellationToken
        );

        response.Answer.ShouldBe("answer");
        response.Results.Single().Url.ShouldBe("https://example.com");
    }

    [Fact]
    public async Task Extract_posts_urls_and_returns_extracted_content()
    {
        using var client = CreateClient(
            "{\"results\":[{\"url\":\"https://example.com\",\"raw_content\":\"hello\"}],\"failed_results\":[]}",
            async request =>
            {
                request.RequestUri!.PathAndQuery.ShouldBe("/extract");
                var body = await request.Content!.ReadFromJsonAsync<TavilyExtractRequest>();
                body!.Urls.ShouldContain("https://example.com");
            }
        );
        var tavily = new TavilyClient(client, "test-key");

        var response = await tavily.ExtractAsync(
            new TavilyExtractRequest { Urls = ["https://example.com"] },
            TestContext.Current.CancellationToken
        );

        response.Results.Single().RawContent.ShouldBe("hello");
    }

    [Fact]
    public async Task Search_serializes_extended_openapi_options()
    {
        using var client = CreateClient(
            "{\"query\":\"dotnet\",\"results\":[]}",
            async request =>
            {
                var body = await request.Content!.ReadFromJsonAsync<JsonElement>();
                body.GetProperty("topic").GetString().ShouldBe("news");
                body.GetProperty("include_domains")[0].GetString().ShouldBe("learn.microsoft.com");
                body.GetProperty("include_images").GetBoolean().ShouldBeTrue();
                body.GetProperty("safe_search").GetBoolean().ShouldBeTrue();
            }
        );
        var tavily = new TavilyClient(client, "test-key");

        await tavily.SearchAsync(
            new TavilySearchRequest
            {
                Query = "dotnet",
                Topic = "news",
                IncludeDomains = ["learn.microsoft.com"],
                IncludeImages = true,
                SafeSearch = true,
            }
        );
    }

    [Fact]
    public async Task Crawl_map_and_research_use_documented_endpoints()
    {
        using var client = CreateClient(
            "{\"base_url\":\"https://docs.example.com\",\"results\":[],\"request_id\":\"r1\"}",
            request =>
            {
                request.RequestUri!.PathAndQuery.ShouldBeOneOf("/crawl", "/map", "/research");
                return Task.CompletedTask;
            }
        );
        var tavily = new TavilyClient(client, "test-key");

        await tavily.CrawlAsync(new TavilyCrawlRequest { Url = "https://docs.example.com" });
        await tavily.MapAsync(new TavilyMapRequest { Url = "https://docs.example.com" });
        await tavily.ResearchAsync(new TavilyResearchRequest { Input = "Summarize .NET 10" });
    }

    [Fact]
    public async Task GetResearch_uses_research_status_endpoint()
    {
        using var client = CreateClient(
            "{\"request_id\":\"r1\",\"status\":\"completed\",\"sources\":[]}",
            request =>
            {
                request.Method.ShouldBe(HttpMethod.Get);
                request.RequestUri!.PathAndQuery.ShouldBe("/research/r1");
                return Task.CompletedTask;
            }
        );
        var tavily = new TavilyClient(client, "test-key");

        var response = await tavily.GetResearchAsync("r1");

        response.Status.ShouldBe("completed");
    }

    [Fact]
    public async Task Search_context_and_qna_helpers_build_search_requests()
    {
        using var client = CreateClient(
            "{\"answer\":\"42\",\"results\":[{\"url\":\"https://example.com\",\"content\":\"answer\"}]}",
            async request =>
            {
                var body = await request.Content!.ReadFromJsonAsync<JsonElement>();
                body.GetProperty("query").GetString().ShouldBe("meaning");
            }
        );
        var tavily = new TavilyClient(client, "test-key");

        var context = await tavily.GetSearchContextAsync(
            new TavilySearchContextRequest { Query = "meaning" }
        );
        var answer = await tavily.QnaSearchAsync("meaning");

        context.ShouldContain("https://example.com");
        answer.ShouldBe("42");
    }

    [Fact]
    public void Tool_wrappers_expose_search_and_extract_functions()
    {
        var tavily = new TavilyClient(new HttpClient(new StubHandler("{}")), "test-key");

        tavily.AsSearchTool().Name.ShouldBe("tavily_search");
        tavily.AsExtractTool().Name.ShouldBe("tavily_extract");
    }

    [Fact]
    public void Constructor_rejects_missing_api_key_with_tavily_exception()
    {
        var exception = Should.Throw<MissingApiKeyException>(
            () => new TavilyClient(new HttpClient(new StubHandler("{}")), " ")
        );

        exception.ParamName.ShouldBe("apiKey");
    }

    [Fact]
    public async Task Constructor_reads_api_key_from_env_file()
    {
        var envFile = Path.Combine(Path.GetTempPath(), $"tavily-{Guid.NewGuid():N}.env");
        await File.WriteAllTextAsync(envFile, "OTHER=value\nexport TAVILY_API_KEY=env-file-key\n");

        try
        {
            using var client = CreateClient(
                "{\"query\":\"dotnet\",\"results\":[]}",
                request =>
                {
                    request.Headers.Authorization!.Parameter.ShouldBe("env-file-key");
                    return Task.CompletedTask;
                }
            );
            var tavily = new TavilyClient(client, envFilePath: envFile);

            await tavily.SearchAsync(new TavilySearchRequest { Query = "dotnet" });
        }
        finally
        {
            File.Delete(envFile);
        }
    }

    [Theory]
    [InlineData(HttpStatusCode.BadRequest, typeof(BadRequestException))]
    [InlineData(HttpStatusCode.Unauthorized, typeof(InvalidApiKeyException))]
    [InlineData(HttpStatusCode.Forbidden, typeof(ForbiddenException))]
    [InlineData(HttpStatusCode.TooManyRequests, typeof(UsageLimitExceededException))]
    public async Task Search_maps_tavily_http_errors_to_typed_exceptions(
        HttpStatusCode statusCode,
        Type exceptionType
    )
    {
        using var client = CreateClient(
            "{\"detail\":{\"error\":\"request failed\"}}",
            _ => Task.CompletedTask,
            statusCode
        );
        var tavily = new TavilyClient(client, "test-key");

        var exception = await Should.ThrowAsync<TavilyException>(
            () => tavily.SearchAsync(new TavilySearchRequest { Query = "dotnet" })
        );

        exception.GetType().ShouldBe(exceptionType);
        exception.Message.ShouldBe("request failed");
    }

    [Fact]
    public async Task Search_maps_keyless_limit_envelope_to_structured_exception()
    {
        using var client = CreateClient(
            "{\"error\":{\"code\":\"rate_limited\",\"message\":\"try later\",\"window\":\"hour\",\"retry_after_seconds\":30,\"next_actions\":[\"wait\"]}}",
            _ => Task.CompletedTask,
            HttpStatusCode.TooManyRequests
        );
        var tavily = new TavilyClient(client, "test-key");

        var exception = await Should.ThrowAsync<TavilyKeylessLimitException>(
            () => tavily.SearchAsync(new TavilySearchRequest { Query = "dotnet" })
        );

        exception.Code.ShouldBe("rate_limited");
        exception.Window.ShouldBe("hour");
        exception.RetryAfterSeconds.ShouldBe(30);
        exception.NextActions.Single().GetString().ShouldBe("wait");
    }

    private static HttpClient CreateClient(
        string response,
        Func<HttpRequestMessage, Task> onRequest,
        HttpStatusCode statusCode = HttpStatusCode.OK
    ) => new(new StubHandler(response, onRequest, statusCode));

    private sealed class StubHandler(
        string response,
        Func<HttpRequestMessage, Task>? onRequest = null,
        HttpStatusCode statusCode = HttpStatusCode.OK
    ) : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken
        )
        {
            if (onRequest is not null)
            {
                await onRequest(request);
            }

            return new HttpResponseMessage(statusCode) { Content = new StringContent(response) };
        }
    }
}
