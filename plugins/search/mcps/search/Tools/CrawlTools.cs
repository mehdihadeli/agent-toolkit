using System.ComponentModel;
using System.Text.RegularExpressions;
using ModelContextProtocol.Server;

public sealed class CrawlTools(FetchTools fetchTools)
{
    private static readonly Regex LinkPattern =
        new("\\[[^]]+\\]\\(([^)#]+)", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    [McpServerTool(Name = "crawl")]
    [Description(
        "Crawl same-origin public pages and return bounded AI-readable Markdown. Every page request uses GET."
    )]
    public async Task<string> CrawlAsync(
        [Description("Public HTTP or HTTPS starting URL.")] string url,
        [Description("Maximum same-origin pages to visit, from 1 to 20.")] int max_pages = 5,
        [Description("Maximum link depth, from 0 to 3.")] int max_depth = 1,
        CancellationToken cancellationToken = default
    )
    {
        if (max_pages is < 1 or > 20)
        {
            throw new ArgumentOutOfRangeException(
                nameof(max_pages),
                "max_pages must be between 1 and 20."
            );
        }

        if (max_depth is < 0 or > 3)
        {
            throw new ArgumentOutOfRangeException(
                nameof(max_depth),
                "max_depth must be between 0 and 3."
            );
        }

        if (!Uri.TryCreate(url, UriKind.Absolute, out var startUri))
        {
            throw new ArgumentException("url must be an absolute HTTP or HTTPS URL.", nameof(url));
        }

        var origin = startUri.GetLeftPart(UriPartial.Authority);
        if (!await IsAllowedByRobotsAsync(startUri, cancellationToken))
        {
            return $"# Crawl: {startUri}\n\nCrawl disallowed by robots.txt.";
        }

        var pending = new Queue<(Uri Uri, int Depth)>();
        var visited = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        pending.Enqueue((startUri, 0));
        var output = new System.Text.StringBuilder($"# Crawl: {startUri}\n\n");

        while (pending.Count > 0 && visited.Count < max_pages)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var (currentUri, depth) = pending.Dequeue();
            if (!visited.Add(currentUri.AbsoluteUri) || !IsSameOrigin(currentUri, origin))
            {
                continue;
            }

            string content;
            try
            {
                content = await fetchTools.FetchAsync(
                    currentUri.AbsoluteUri,
                    format: "markdown",
                    max_length: 12_000,
                    cancellationToken: cancellationToken
                );
            }
            catch (HttpRequestException)
            {
                continue;
            }
            catch (ArgumentException)
            {
                continue;
            }

            output.AppendLine($"## {currentUri}");
            output.AppendLine(content);
            output.AppendLine();

            if (depth >= max_depth)
            {
                continue;
            }

            foreach (var link in ExtractLinks(content, currentUri))
            {
                if (
                    IsSameOrigin(link, origin)
                    && !visited.Contains(link.AbsoluteUri)
                    && await IsAllowedByRobotsAsync(link, cancellationToken)
                )
                {
                    pending.Enqueue((link, depth + 1));
                }
            }
        }

        return output.ToString().TrimEnd();
    }

    private async Task<bool> IsAllowedByRobotsAsync(Uri uri, CancellationToken cancellationToken)
    {
        var robotsUri = new Uri(uri.GetLeftPart(UriPartial.Authority) + "/robots.txt");
        string robots;
        try
        {
            robots = await fetchTools.FetchAsync(
                robotsUri.AbsoluteUri,
                format: "raw",
                max_length: 100_000,
                cancellationToken: cancellationToken
            );
        }
        catch (HttpRequestException)
        {
            return true;
        }

        var applies = false;
        foreach (var rawLine in robots.Split('\n'))
        {
            var line = rawLine.Trim();
            var commentIndex = line.IndexOf('#');
            if (commentIndex >= 0)
            {
                line = line[..commentIndex].Trim();
            }

            if (line.StartsWith("User-agent:", StringComparison.OrdinalIgnoreCase))
            {
                applies = line["User-agent:".Length..].Trim() == "*";
                continue;
            }

            if (applies && line.StartsWith("Disallow:", StringComparison.OrdinalIgnoreCase))
            {
                var disallowedPath = line["Disallow:".Length..].Trim();
                if (
                    disallowedPath.Length > 0
                    && uri.AbsolutePath.StartsWith(disallowedPath, StringComparison.Ordinal)
                )
                {
                    return false;
                }
            }
        }

        return true;
    }

    private static IEnumerable<Uri> ExtractLinks(string content, Uri baseUri)
    {
        foreach (Match match in LinkPattern.Matches(content))
        {
            if (Uri.TryCreate(baseUri, match.Groups[1].Value, out var link))
            {
                yield return link;
            }
        }
    }

    private static bool IsSameOrigin(Uri uri, string origin) =>
        string.Equals(
            uri.GetLeftPart(UriPartial.Authority),
            origin,
            StringComparison.OrdinalIgnoreCase
        );
}
