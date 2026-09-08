using System.ComponentModel;
using GitHub.Copilot.SDK;
using AgentSkillsMcp.DotnetQualityAgent;
using Microsoft.Extensions.AI;

var workingDirectory = Path.GetFullPath(
    Environment.GetEnvironmentVariable("QUALITY_AGENT_WORKING_DIRECTORY")
        ?? Environment.CurrentDirectory
);

if (!Directory.Exists(workingDirectory))
{
    throw new DirectoryNotFoundException($"Workspace does not exist: {workingDirectory}");
}

var analyze = AIFunctionFactory.Create(
    async ([Description("all, whitespace, style, or analyzers")] string scope = "all") =>
    {
        var previousDirectory = Environment.GetEnvironmentVariable(
            "QUALITY_AGENT_WORKING_DIRECTORY"
        );
        Environment.SetEnvironmentVariable("QUALITY_AGENT_WORKING_DIRECTORY", workingDirectory);
        try
        {
            var runner = new DotnetFormatRunner();
            var scopes = scope.Trim().ToLowerInvariant() switch
            {
                "all" or "" => new[]
                {
                    FormatScope.Whitespace,
                    FormatScope.Style,
                    FormatScope.Analyzers,
                },
                "whitespace" => new[] { FormatScope.Whitespace },
                "style" => new[] { FormatScope.Style },
                "analyzers" => new[] { FormatScope.Analyzers },
                _ => throw new ArgumentException(
                    "scope must be all, whitespace, style, or analyzers."
                ),
            };

            var results = new List<FormatRunResult>();
            foreach (var selectedScope in scopes)
            {
                results.Add(await runner.AnalyzeAsync(selectedScope, CancellationToken.None));
            }

            return string.Join(
                "\n\n",
                results.Select(result =>
                    $"## {result.Scope}\n"
                    + $"Status: {(result.Succeeded ? "clean" : $"exit {result.ExitCode}")}\n"
                    + $"Diagnostics: {result.Diagnostics.Count}\n"
                    + string.Join(
                        "\n",
                        result
                            .Diagnostics.GroupBy(diagnostic => diagnostic.RuleId)
                            .OrderByDescending(group => group.Count())
                            .Select(group =>
                                $"- {group.Key} ({group.Count()}): "
                                + string.Join(
                                    ", ",
                                    group
                                        .Take(20)
                                        .Select(diagnostic =>
                                            $"{diagnostic.FilePath}:{diagnostic.Line}"
                                        )
                                )
                            )
                    )
                )
            );
        }
        finally
        {
            Environment.SetEnvironmentVariable(
                "QUALITY_AGENT_WORKING_DIRECTORY",
                previousDirectory
            );
        }
    },
    "analyze_dotnet_quality",
    "Run dotnet format in a .NET workspace and return grouped diagnostics."
);

await using var client = new CopilotClient();
await using var session = await client.CreateSessionAsync(
    new SessionConfig
    {
        Model = Environment.GetEnvironmentVariable("COPILOT_MODEL") ?? "auto",
        Tools = [analyze],
        SystemMessage = new SystemMessageConfig
        {
            Mode = SystemMessageMode.Append,
            Content =
                "You are a .NET quality analyst. Call analyze_dotnet_quality before making claims. "
                + "Prioritize findings by impact and confidence, explain affected files, and suggest "
                + "safe fixes. Never modify files or claim fixes were applied.",
        },
    }
);

var prompt =
    args.Length > 0
        ? string.Join(' ', args)
        : "Analyze this .NET workspace and tell me what should be fixed first.";
var response = new TaskCompletionSource<string>();
using var subscription = session.On(evt =>
{
    if (evt is AssistantMessageEvent message)
    {
        response.TrySetResult(message.Data.Content);
    }
    else if (evt is SessionErrorEvent error)
    {
        response.TrySetException(new InvalidOperationException(error.Data.Message));
    }
});
await session.SendAsync(new MessageOptions { Prompt = prompt });
Console.WriteLine(await response.Task);
