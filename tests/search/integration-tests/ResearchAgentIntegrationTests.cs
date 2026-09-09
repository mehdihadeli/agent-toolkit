using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.AI;
using ModelContextProtocol.Client;
using Shouldly;
using Xunit;

namespace AgentSkillsMcp.Search.Tests;

public sealed class ResearchIntegrationTests : IClassFixture<SearchMcpFactory>
{
    private readonly SearchMcpFactory _factory;

    public ResearchIntegrationTests(SearchMcpFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Research_mcp_exposes_research_tool_over_streamable_http()
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

        tools.Select(tool => tool.Name).ShouldContain("research");
    }

    [Fact]
    public async Task Research_rejects_empty_question()
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
        var research = (
            await client.ListToolsAsync(cancellationToken: TestContext.Current.CancellationToken)
        ).Single(tool => tool.Name == "research");

        var result = await research.InvokeAsync(
            new AIFunctionArguments { ["question"] = " " },
            TestContext.Current.CancellationToken
        );

        result!.ToString()!.ShouldContain("isError");
    }
}

public sealed class SearchMcpFactory : WebApplicationFactory<SearchProgram>
{
    public SearchMcpFactory()
    {
        Environment.SetEnvironmentVariable("Search__Transport", "http");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
    }
}
