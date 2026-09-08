using System.Diagnostics;
using System.Text.Json;

namespace AgentSkillsMcp.DotnetQualityAgent;

public enum FormatScope
{
    Whitespace,
    Style,
    Analyzers,
}

public sealed record FormatDiagnostic(
    string FilePath,
    string RuleId,
    string Message,
    int? Line,
    int? Column
);

public sealed record FormatRunResult(
    FormatScope Scope,
    int ExitCode,
    IReadOnlyList<FormatDiagnostic> Diagnostics,
    string ErrorOutput
)
{
    public bool Succeeded => ExitCode == 0;
}

public interface IDotnetFormatRunner
{
    Task<FormatRunResult> AnalyzeAsync(FormatScope scope, CancellationToken cancellationToken);
    Task<FormatRunResult> FixAsync(FormatScope scope, CancellationToken cancellationToken);
}

public sealed class DotnetFormatRunner : IDotnetFormatRunner
{
    private static readonly TimeSpan ProcessTimeout = TimeSpan.FromMinutes(2);

    public Task<FormatRunResult> AnalyzeAsync(
        FormatScope scope,
        CancellationToken cancellationToken
    ) => RunAsync(scope, verifyOnly: true, cancellationToken);

    public Task<FormatRunResult> FixAsync(FormatScope scope, CancellationToken cancellationToken) =>
        RunAsync(scope, verifyOnly: false, cancellationToken);

    private async Task<FormatRunResult> RunAsync(
        FormatScope scope,
        bool verifyOnly,
        CancellationToken cancellationToken
    )
    {
        var workspace = GetWorkspace();
        var reportPath = Path.Combine(Path.GetTempPath(), $"dotnet-format-{Guid.NewGuid():N}.json");
        try
        {
            var arguments = BuildArguments(workspace, scope, verifyOnly, reportPath);
            var startInfo = new ProcessStartInfo
            {
                FileName = "dotnet",
                WorkingDirectory = workspace,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            foreach (var argument in arguments)
            {
                startInfo.ArgumentList.Add(argument);
            }

            using var process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
            if (!process.Start())
            {
                throw new InvalidOperationException("Could not start dotnet format.");
            }

            var outputTask = process.StandardOutput.ReadToEndAsync(cancellationToken);
            var errorTask = process.StandardError.ReadToEndAsync(cancellationToken);
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(ProcessTimeout);
            try
            {
                await process.WaitForExitAsync(timeout.Token);
            }
            catch
            {
                if (!process.HasExited)
                {
                    process.Kill(entireProcessTree: true);
                }
                throw;
            }
            var errorOutput = await errorTask;
            _ = await outputTask;
            var diagnostics = await ReadDiagnosticsAsync(reportPath, cancellationToken);
            return new FormatRunResult(scope, process.ExitCode, diagnostics, errorOutput.Trim());
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new TimeoutException("dotnet format exceeded its two-minute execution limit.");
        }
        finally
        {
            File.Delete(reportPath);
        }
    }

    public static IReadOnlyList<string> BuildArguments(
        string workspace,
        FormatScope scope,
        bool verifyOnly,
        string reportPath
    )
    {
        var arguments = new List<string>
        {
            "format",
            workspace,
            scope switch
            {
                FormatScope.Whitespace => "whitespace",
                FormatScope.Style => "style",
                FormatScope.Analyzers => "analyzers",
                _ => throw new ArgumentOutOfRangeException(nameof(scope)),
            },
            "--report",
            reportPath,
            "--severity",
            "warn",
        };
        if (verifyOnly)
        {
            arguments.Add("--verify-no-changes");
        }
        return arguments;
    }

    private string GetWorkspace()
    {
        var configured = Environment.GetEnvironmentVariable("QUALITY_AGENT_WORKING_DIRECTORY");
        var workspace = Path.GetFullPath(
            string.IsNullOrWhiteSpace(configured) ? Environment.CurrentDirectory : configured
        );
        if (!Directory.Exists(workspace))
        {
            throw new DirectoryNotFoundException($"Workspace does not exist: {workspace}");
        }
        if (
            !Directory.EnumerateFiles(workspace, "*.slnx").Any()
            && !Directory.EnumerateFiles(workspace, "*.sln").Any()
            && !Directory.EnumerateFiles(workspace, "*.csproj").Any()
        )
        {
            throw new InvalidOperationException(
                "Workspace must contain a .slnx, .sln, or .csproj file."
            );
        }
        return workspace;
    }

    private static async Task<IReadOnlyList<FormatDiagnostic>> ReadDiagnosticsAsync(
        string reportPath,
        CancellationToken cancellationToken
    )
    {
        if (!File.Exists(reportPath))
        {
            return [];
        }
        await using var stream = File.OpenRead(reportPath);
        using var document = await JsonDocument.ParseAsync(
            stream,
            cancellationToken: cancellationToken
        );
        var diagnostics = new List<FormatDiagnostic>();
        CollectDiagnostics(document.RootElement, diagnostics);
        return diagnostics;
    }

    private static void CollectDiagnostics(
        JsonElement element,
        ICollection<FormatDiagnostic> diagnostics
    )
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            var file = GetString(element, "FilePath", "FileName", "File");
            var rule = GetString(element, "DiagnosticId", "RuleId", "Id");
            var message = GetString(element, "DiagnosticMessage", "Message", "Description");
            if (
                !string.IsNullOrWhiteSpace(file)
                && (!string.IsNullOrWhiteSpace(rule) || !string.IsNullOrWhiteSpace(message))
            )
            {
                diagnostics.Add(
                    new FormatDiagnostic(
                        file,
                        rule ?? "unknown",
                        message ?? "Diagnostic reported.",
                        GetInt(element, "StartLineNumber", "Line"),
                        GetInt(element, "StartColumn", "Column")
                    )
                );
            }
            foreach (var property in element.EnumerateObject())
            {
                CollectDiagnostics(property.Value, diagnostics);
            }
        }
        else if (element.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in element.EnumerateArray())
            {
                CollectDiagnostics(item, diagnostics);
            }
        }
    }

    private static string? GetString(JsonElement element, params string[] names)
    {
        foreach (var name in names)
        {
            if (
                element.TryGetProperty(name, out var value)
                && value.ValueKind == JsonValueKind.String
            )
            {
                return value.GetString();
            }
        }
        return null;
    }

    private static int? GetInt(JsonElement element, params string[] names)
    {
        foreach (var name in names)
        {
            if (element.TryGetProperty(name, out var value) && value.TryGetInt32(out var result))
            {
                return result;
            }
        }
        return null;
    }
}
