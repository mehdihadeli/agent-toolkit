using AgentSkillsMcp.Tavily;
using Shouldly;
using Xunit;

namespace AgentSkillsMcp.Search.Tests;

public sealed class TavilySdkIntegrationTests
{
    public static bool LiveTestsEnabled =>
        string.Equals(
            Environment.GetEnvironmentVariable("TAVILY_RUN_LIVE_TESTS"),
            "1",
            StringComparison.Ordinal
        ) && !string.IsNullOrWhiteSpace(TavilyApiKeyResolver.Resolve());

    [Fact(
        Skip = "Set TAVILY_RUN_LIVE_TESTS=1 and provide TAVILY_API_KEY to run live tests.",
        SkipUnless = nameof(LiveTestsEnabled)
    )]
    public async Task Search_returns_live_tavily_results()
    {
        var (tavily, cancellationToken) = CreateLiveClient();

        var response = await tavily.SearchAsync(
            new TavilySearchRequest
            {
                Query = "Microsoft .NET official documentation",
                MaxResults = 1,
                IncludeAnswer = false,
                IncludeRawContent = false,
            },
            cancellationToken
        );

        response.Results.ShouldNotBeEmpty();
        response.Results[0].Url.ShouldNotBeNullOrWhiteSpace();
        response.Results[0].Content.ShouldNotBeNullOrWhiteSpace();
    }

    [Fact(
        Skip = "Set TAVILY_RUN_LIVE_TESTS=1 and provide TAVILY_API_KEY to run live tests.",
        SkipUnless = nameof(LiveTestsEnabled)
    )]
    public async Task Extract_returns_live_tavily_content()
    {
        var (tavily, cancellationToken) = CreateLiveClient();

        var response = await tavily.ExtractAsync(
            new TavilyExtractRequest
            {
                Urls =
                [
                    "https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/overview",
                ],
            },
            cancellationToken
        );

        response.Results.ShouldNotBeEmpty();
        var extractedUrl = response.Results[0].Url;
        extractedUrl.ShouldNotBeNullOrWhiteSpace();
        extractedUrl.ShouldContain("learn.microsoft.com");
        response.Results[0].RawContent.ShouldNotBeNullOrWhiteSpace();
    }

    [Fact(
        Skip = "Set TAVILY_RUN_LIVE_TESTS=1 and provide TAVILY_API_KEY to run live tests.",
        SkipUnless = nameof(LiveTestsEnabled)
    )]
    public async Task Crawl_returns_live_pages_from_tavily_docs()
    {
        var (tavily, cancellationToken) = CreateLiveClient();

        var response = await tavily.CrawlAsync(
            new TavilyCrawlRequest
            {
                Url = "https://docs.tavily.com",
                MaxDepth = 1,
                MaxBreadth = 3,
                Limit = 3,
                IncludeUsage = true,
            },
            cancellationToken
        );

        response.BaseUrl.ShouldNotBeNullOrWhiteSpace();
        response.Results.ShouldNotBeEmpty();
        response.Results[0].Url.ShouldNotBeNullOrWhiteSpace();
        response.Results[0].RawContent.ShouldNotBeNullOrWhiteSpace();
    }

    [Fact(
        Skip = "Set TAVILY_RUN_LIVE_TESTS=1 and provide TAVILY_API_KEY to run live tests.",
        SkipUnless = nameof(LiveTestsEnabled)
    )]
    public async Task Map_returns_live_urls_from_tavily_docs()
    {
        var (tavily, cancellationToken) = CreateLiveClient();

        var response = await tavily.MapAsync(
            new TavilyMapRequest
            {
                Url = "https://docs.tavily.com",
                MaxDepth = 1,
                MaxBreadth = 3,
                Limit = 3,
                IncludeUsage = true,
            },
            cancellationToken
        );

        response.BaseUrl.ShouldNotBeNullOrWhiteSpace();
        response.Results.ShouldNotBeEmpty();
        response.Results[0].ShouldStartWith("http");
    }

    [Fact(
        Skip = "Set TAVILY_RUN_LIVE_TESTS=1 and provide TAVILY_API_KEY to run live tests.",
        SkipUnless = nameof(LiveTestsEnabled)
    )]
    public async Task Search_context_returns_serialized_live_sources()
    {
        var (tavily, cancellationToken) = CreateLiveClient();

        var context = await tavily.GetSearchContextAsync(
            new TavilySearchContextRequest
            {
                Query = "Microsoft .NET official documentation",
                MaxResults = 2,
            },
            cancellationToken: cancellationToken
        );

        context.ShouldContain("learn.microsoft.com");
        context.Length.ShouldBeGreaterThan(20);
    }

    [Fact(
        Skip = "Set TAVILY_RUN_LIVE_TESTS=1 and provide TAVILY_API_KEY to run live tests.",
        SkipUnless = nameof(LiveTestsEnabled)
    )]
    public async Task Qna_search_returns_live_answer()
    {
        var (tavily, cancellationToken) = CreateLiveClient();

        var answer = await tavily.QnaSearchAsync("What is Microsoft .NET?", cancellationToken);

        answer.ShouldNotBeNullOrWhiteSpace();
    }

    [Fact(
        Skip = "Set TAVILY_RUN_LIVE_TESTS=1 and provide TAVILY_API_KEY to run live tests.",
        SkipUnless = nameof(LiveTestsEnabled)
    )]
    public async Task Research_can_be_created_and_polled_to_completion()
    {
        var (tavily, cancellationToken) = CreateLiveClient(TimeSpan.FromMinutes(3));

        var queued = await tavily.ResearchAsync(
            new TavilyResearchRequest
            {
                Input = "Give a brief summary of Microsoft .NET from official sources.",
                Model = "mini",
                OutputLength = "short",
                IncludeDomains = ["learn.microsoft.com"],
            },
            cancellationToken
        );

        queued.RequestId.ShouldNotBeNullOrWhiteSpace();

        TavilyResearchResponse result = queued;
        for (var attempt = 0; attempt < 24; attempt++)
        {
            if (result.Status is "completed" or "failed")
            {
                break;
            }

            await Task.Delay(TimeSpan.FromSeconds(5), cancellationToken);
            result = await tavily.GetResearchAsync(result.RequestId!, cancellationToken);
        }

        result.Status.ShouldBe("completed");
        result.Content.ShouldNotBeNull();
        result.Sources.ShouldNotBeEmpty();
    }

    private static (TavilyClient Client, CancellationToken CancellationToken) CreateLiveClient(
        TimeSpan? timeout = null
    )
    {
        var apiKey = TavilyApiKeyResolver.Resolve();
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException(
                "TAVILY_API_KEY was not found in the environment or .env."
            );
        }

        var httpClient = new HttpClient { Timeout = timeout ?? TimeSpan.FromSeconds(90) };
        return (new TavilyClient(httpClient, apiKey), TestContext.Current.CancellationToken);
    }
}
