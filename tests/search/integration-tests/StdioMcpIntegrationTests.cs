using ModelContextProtocol.Client;
using Shouldly;
using Xunit;

public sealed class StdioMcpIntegrationTests
{
    [Fact]
    public async Task Unified_search_mcp_discovers_tools_over_stdio()
    {
        var repositoryDirectory = new DirectoryInfo(AppContext.BaseDirectory);
        while (
            repositoryDirectory is not null
            && !File.Exists(Path.Combine(repositoryDirectory.FullName, "agent-toolkit.slnx"))
        )
        {
            repositoryDirectory = repositoryDirectory.Parent;
        }

        repositoryDirectory.ShouldNotBeNull();
        var projectPath = Path.Combine(
            repositoryDirectory.FullName,
            "plugins",
            "search",
            "mcps",
            "search",
            "AgentSkillsMcp.Search.csproj"
        );
        var transport = new StdioClientTransport(
            new StdioClientTransportOptions
            {
                Name = "agent-toolkit-search",
                Command = "dotnet",
                Arguments =
                [
                    "run",
                    "--project",
                    projectPath,
                    "--no-launch-profile",
                    "--",
                    "--transport",
                    "stdio",
                ],
            }
        );

        await using (
            var client = await McpClient.CreateAsync(
                transport,
                cancellationToken: TestContext.Current.CancellationToken
            )
        )
        {
            var tools = await client.ListToolsAsync(
                cancellationToken: TestContext.Current.CancellationToken
            );

            tools.Select(tool => tool.Name).ShouldContain("fetch");
            tools.Select(tool => tool.Name).ShouldContain("search");
            tools.Select(tool => tool.Name).ShouldContain("research");
        }
    }
}
