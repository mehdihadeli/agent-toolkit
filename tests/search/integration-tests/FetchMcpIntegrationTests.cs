using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.AI;
using ModelContextProtocol.Client;
using Shouldly;
using Xunit;

public sealed class FetchMcpIntegrationTests : IClassFixture<FetchMcpFactory>
{
    private readonly FetchMcpFactory _factory;

    public FetchMcpIntegrationTests(FetchMcpFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Local_mcp_client_discovers_fetch_tools_over_streamable_http()
    {
        using var httpClient = _factory.CreateClient();
        await using var transport = new HttpClientTransport(
            new HttpClientTransportOptions
            {
                Endpoint = httpClient.BaseAddress!,
                TransportMode = HttpTransportMode.StreamableHttp,
            },
            httpClient
        );
        await using var client = await McpClient.CreateAsync(
            transport,
            cancellationToken: TestContext.Current.CancellationToken
        );

        var tools = await client.ListToolsAsync(
            cancellationToken: TestContext.Current.CancellationToken
        );

        tools.Select(tool => tool.Name).ShouldContain("fetch");
        tools.Select(tool => tool.Name).ShouldContain("crawl");
        tools.Select(tool => tool.Name).ShouldContain("search");
        tools.Select(tool => tool.Name).ShouldContain("discover_llms_txt");
    }

    [Fact]
    public async Task Local_mcp_client_invokes_fetch_and_gets_security_error()
    {
        using var httpClient = _factory.CreateClient();
        await using var transport = new HttpClientTransport(
            new HttpClientTransportOptions
            {
                Endpoint = httpClient.BaseAddress!,
                TransportMode = HttpTransportMode.StreamableHttp,
            },
            httpClient
        );
        await using var client = await McpClient.CreateAsync(
            transport,
            cancellationToken: TestContext.Current.CancellationToken
        );
        var fetch = (
            await client.ListToolsAsync(cancellationToken: TestContext.Current.CancellationToken)
        ).Single(tool => tool.Name == "fetch");

        var result = await fetch.InvokeAsync(
            new AIFunctionArguments { ["url"] = "http://localhost" },
            TestContext.Current.CancellationToken
        );

        result.ShouldNotBeNull();
        result.ToString()!.ShouldContain("\"isError\":true");
    }
}

public sealed class FetchMcpFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
    }
}