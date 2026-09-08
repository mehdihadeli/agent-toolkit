namespace AgentSkillsMcp.Tavily;

public static class TavilyApiKeyResolver
{
    public static string? Resolve(string? explicitApiKey = null, string? envFilePath = null)
    {
        if (!string.IsNullOrWhiteSpace(explicitApiKey))
        {
            return explicitApiKey;
        }

        var environmentKey = Environment.GetEnvironmentVariable("TAVILY_API_KEY");
        if (!string.IsNullOrWhiteSpace(environmentKey))
        {
            return environmentKey;
        }

        foreach (var candidate in GetEnvironmentFileCandidates(envFilePath))
        {
            var key = ReadKey(candidate);
            if (!string.IsNullOrWhiteSpace(key))
            {
                return key;
            }
        }

        return null;
    }

    private static IEnumerable<string> GetEnvironmentFileCandidates(string? envFilePath)
    {
        if (!string.IsNullOrWhiteSpace(envFilePath))
        {
            yield return Path.GetFullPath(envFilePath);
            yield break;
        }

        for (
            var directory = new DirectoryInfo(Directory.GetCurrentDirectory());
            directory is not null;
            directory = directory.Parent
        )
        {
            yield return Path.Combine(directory.FullName, ".env");
        }
    }

    private static string? ReadKey(string path)
    {
        if (!File.Exists(path))
        {
            return null;
        }

        foreach (var line in File.ReadLines(path))
        {
            var value = line.Trim();
            if (value.StartsWith("export ", StringComparison.Ordinal))
            {
                value = value["export ".Length..].TrimStart();
            }

            if (value.Length == 0 || value.StartsWith('#'))
            {
                continue;
            }

            var separator = value.IndexOf('=');
            if (
                separator <= 0
                || !value[..separator].Trim().Equals("TAVILY_API_KEY", StringComparison.Ordinal)
            )
            {
                continue;
            }

            return Unquote(value[(separator + 1)..].Trim());
        }

        return null;
    }

    private static string Unquote(string value)
    {
        if (
            value.Length >= 2
            && ((value[0] == '"' && value[^1] == '"') || (value[0] == '\'' && value[^1] == '\''))
        )
        {
            return value[1..^1];
        }

        var comment = value.IndexOf(" #", StringComparison.Ordinal);
        return comment >= 0 ? value[..comment].TrimEnd() : value;
    }
}
