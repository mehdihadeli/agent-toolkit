using System.Net;
using Shouldly;
using Xunit;

public sealed class FetchToolsTests
{
    [Fact]
    public async Task Fetch_rejects_local_urls_before_network_call()
    {
        var tools = new FetchTools(new StubHttpClientFactory());

        var exception = await Should.ThrowAsync<ArgumentException>(
            () =>
                tools.FetchAsync("http://localhost:8080", cancellationToken: CancellationToken.None)
        );

        exception.Message.ShouldContain("Local URLs are not allowed");
    }

    [Fact]
    public async Task Fetch_readable_format_extracts_text_from_html()
    {
        using var client = CreateClient(
            "<html><body><h1>Title</h1><script>ignore()</script><p>Hello &amp; welcome</p></body></html>",
            "text/html"
        );
        var tools = new FetchTools(new StubHttpClientFactory(client));

        var result = await tools.FetchAsync(
            "https://example.com/page",
            format: "readable",
            cancellationToken: CancellationToken.None
        );

        result.ShouldContain("Title");
        result.ShouldContain("Hello & welcome");
        result.ShouldNotContain("ignore()");
        result.ShouldNotContain("<h1>");
    }

    [Fact]
    public async Task Fetch_markdown_format_preserves_headings_and_links()
    {
        using var client = CreateClient(
            "<article><h1>Title</h1><p>Read <a href=\"/docs\">docs</a>.</p></article>",
            "text/html"
        );
        var tools = new FetchTools(new StubHttpClientFactory(client));

        var result = await tools.FetchAsync(
            "https://example.com/page",
            format: "markdown",
            cancellationToken: CancellationToken.None
        );

        result.ShouldContain("# Title");
        result.ShouldContain("[docs](/docs)");
        result.ShouldNotContain("<article>");
    }

    [Fact]
    public async Task Fetch_uses_get_for_every_page_request()
    {
        HttpMethod? method = null;
        using var client = CreateClient("hello", "text/plain", request => method = request.Method);
        var tools = new FetchTools(new StubHttpClientFactory(client));

        await tools.FetchAsync(
            "https://example.com/page",
            cancellationToken: CancellationToken.None
        );

        method.ShouldBe(HttpMethod.Get);
    }

    [Fact]
    public async Task Fetch_rejects_unknown_format_before_network_call()
    {
        var tools = new FetchTools(new StubHttpClientFactory());

        var exception = await Should.ThrowAsync<ArgumentException>(
            () =>
                tools.FetchAsync(
                    "https://example.com/page",
                    format: "xml",
                    cancellationToken: CancellationToken.None
                )
        );

        exception.Message.ShouldContain("format must be one of");
    }

    private static HttpClient CreateClient(
        string content,
        string mediaType,
        Action<HttpRequestMessage>? onRequest = null
    ) => new(new StubHttpMessageHandler(content, mediaType, onRequest));

    private sealed class StubHttpClientFactory(HttpClient? client = null) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) =>
            client
            ?? throw new InvalidOperationException(
                "Network client should not be created for a blocked URL."
            );
    }

    private sealed class StubHttpMessageHandler(
        string content,
        string mediaType,
        Action<HttpRequestMessage>? onRequest
    ) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken
        )
        {
            onRequest?.Invoke(request);
            var response = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(content),
            };
            response.Content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(
                mediaType
            );
            return Task.FromResult(response);
        }
    }
}
