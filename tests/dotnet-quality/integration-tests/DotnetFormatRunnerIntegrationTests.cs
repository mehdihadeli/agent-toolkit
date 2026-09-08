using AgentSkillsMcp.DotnetQualityAgent;
using Shouldly;
using Xunit;

public sealed class DotnetFormatRunnerIntegrationTests
{
    [Fact]
    public async Task AnalyzeAsync_runs_against_real_agent_project()
    {
        var projectDirectory = FindProjectDirectory();
        var previousWorkspace = Environment.GetEnvironmentVariable(
            "QUALITY_AGENT_WORKING_DIRECTORY"
        );

        try
        {
            Environment.SetEnvironmentVariable(
                "QUALITY_AGENT_WORKING_DIRECTORY",
                projectDirectory
            );

            var result = await new DotnetFormatRunner().AnalyzeAsync(
                FormatScope.Whitespace,
                TestContext.Current.CancellationToken
            );

            result.Scope.ShouldBe(FormatScope.Whitespace);
            result.ErrorOutput.ShouldNotContain("Workspace must contain");
        }
        finally
        {
            Environment.SetEnvironmentVariable(
                "QUALITY_AGENT_WORKING_DIRECTORY",
                previousWorkspace
            );
        }
    }

    private static string FindProjectDirectory()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            var candidate = Path.Combine(
                directory.FullName,
                "plugins",
                "dotnet-quality",
                "agents",
                "dotnet-quality-agent",
                "AgentSkillsMcp.DotnetQuality.CopilotAgent.csproj"
            );
            if (File.Exists(candidate))
            {
                return Path.GetDirectoryName(candidate)!;
            }

            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException("Could not locate the dotnet-quality agent project.");
    }
}
