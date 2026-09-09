using System.ComponentModel;
using ModelContextProtocol.Server;

public sealed class LlmTextTools(FetchTools fetchTools)
{
    [McpServerTool(Name = "discover_llms_txt")]
    [Description(
        "Discover and fetch a site's llms.txt metadata as AI-readable Markdown. "
            + "Pass either the site URL or the exact llms.txt URL. Requests use GET only."
    )]
    public async Task<string> DiscoverAsync(
        [Description("Public HTTP or HTTPS site URL.")] string url,
        CancellationToken cancellationToken = default
    )
    {
        if (
            !Uri.TryCreate(url, UriKind.Absolute, out var siteUri)
            || siteUri.Scheme is not ("http" or "https")
        )
        {
            throw new ArgumentException("url must be an absolute HTTP or HTTPS URL.", nameof(url));
        }

        var candidates = siteUri.AbsolutePath.EndsWith(
            "/llms.txt",
            StringComparison.OrdinalIgnoreCase
        )
            ? new[] { siteUri }
            : new[] { new Uri(siteUri, "/llms.txt"), new Uri(siteUri, "/.well-known/llms.txt") };

        foreach (var candidate in candidates)
        {
            try
            {
                return await fetchTools.FetchAsync(
                    candidate.AbsoluteUri,
                    format: "markdown",
                    max_length: 50_000,
                    cancellationToken: cancellationToken
                );
            }
            catch (HttpRequestException) { }
        }

        throw new HttpRequestException(
            $"No llms.txt document found for {siteUri.GetLeftPart(UriPartial.Authority)}."
        );
    }
}
