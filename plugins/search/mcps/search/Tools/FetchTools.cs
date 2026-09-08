using System.ComponentModel;
using System.Net;
using System.Text.RegularExpressions;
using ModelContextProtocol.Server;

public sealed class FetchTools(IHttpClientFactory httpClientFactory)
{
    private const int DefaultMaxLength = 50_000;
    private const int MaxResponseBytes = 10 * 1024 * 1024;
    private const int MaxRedirects = 5;
    private static readonly Regex HtmlCommentPattern =
        new(@"<!--.*?-->", RegexOptions.Compiled | RegexOptions.Singleline);
    private static readonly Regex HtmlNonContentPattern =
        new(
            @"<(script|style|noscript)\b[^>]*>.*?</\1\s*>",
            RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.Singleline
        );
    private static readonly Regex HtmlTagPattern = new("<[^>]+>", RegexOptions.Compiled);
    private static readonly Regex HtmlHeadingPattern =
        new(
            @"<h([1-6])\b[^>]*>(.*?)</h\1\s*>",
            RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.Singleline
        );
    private static readonly Regex HtmlLinkPattern =
        new(
            @"<a\b[^>]*href\s*=\s*['""]([^'""]+)['""][^>]*>(.*?)</a\s*>",
            RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.Singleline
        );
    private static readonly Regex HtmlListItemPattern =
        new(
            @"<li\b[^>]*>(.*?)</li\s*>",
            RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.Singleline
        );
    private static readonly Regex WhitespacePattern = new(@"[ \t\r\n]+", RegexOptions.Compiled);

    [McpServerTool(Name = "fetch")]
    [Description(
        "Fetch a public HTTP or HTTPS URL and return its content as text. Use start_index to continue after truncation."
    )]
    public async Task<string> FetchAsync(
        [Description("Public HTTP or HTTPS URL to fetch.")] string url,
        [Description("Maximum number of characters to return. Defaults to 50000.")]
            int max_length = DefaultMaxLength,
        [Description("Character offset from which to return content.")] int start_index = 0,
        [Description("Output format: raw, text, markdown, or readable.")] string format = "raw",
        CancellationToken cancellationToken = default
    )
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var requestedUri))
        {
            throw new ArgumentException("URL must be an absolute HTTP or HTTPS URL.", nameof(url));
        }

        ValidateUri(requestedUri);

        if (max_length is < 1 or > DefaultMaxLength)
        {
            throw new ArgumentOutOfRangeException(
                nameof(max_length),
                $"max_length must be between 1 and {DefaultMaxLength}."
            );
        }

        if (start_index < 0)
        {
            throw new ArgumentOutOfRangeException(
                nameof(start_index),
                "start_index cannot be negative."
            );
        }

        ValidateFormat(format);

        var client = httpClientFactory.CreateClient("fetch");
        using var response = await SendWithValidatedRedirectsAsync(
            client,
            requestedUri,
            cancellationToken
        );
        response.EnsureSuccessStatusCode();

        await using var responseStream = await response.Content.ReadAsStreamAsync(
            cancellationToken
        );
        using var reader = new StreamReader(responseStream);
        var content = await ReadBoundedAsync(reader, cancellationToken);
        content = FormatContent(content, response.Content.Headers.ContentType?.MediaType, format);

        if (start_index >= content.Length)
        {
            return $"No more content available. Content length: {content.Length}.";
        }

        var length = Math.Min(max_length, content.Length - start_index);
        var result = content.Substring(start_index, length);
        var nextIndex = start_index + length;

        return nextIndex < content.Length
            ? $"Contents of {requestedUri}:\n{result}\n\nContent truncated. Continue with start_index={nextIndex}."
            : $"Contents of {requestedUri}:\n{result}";
    }

    private static async Task<HttpResponseMessage> SendWithValidatedRedirectsAsync(
        HttpClient client,
        Uri uri,
        CancellationToken cancellationToken
    )
    {
        for (var redirect = 0; redirect <= MaxRedirects; redirect++)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, uri);
            var response = await client.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken
            );

            if (!IsRedirect(response.StatusCode))
            {
                return response;
            }

            var location =
                response.Headers.Location
                ?? throw new HttpRequestException(
                    "Redirect response did not include a Location header."
                );
            var nextUri = location.IsAbsoluteUri ? location : new Uri(uri, location);
            response.Dispose();
            ValidateUri(nextUri);
            uri = nextUri;
        }

        throw new HttpRequestException($"The URL exceeded the {MaxRedirects} redirect limit.");
    }

    private static async Task<string> ReadBoundedAsync(
        StreamReader reader,
        CancellationToken cancellationToken
    )
    {
        var buffer = new char[8192];
        var builder = new System.Text.StringBuilder();
        var bytes = 0;

        while (true)
        {
            var count = await reader.ReadAsync(buffer.AsMemory(), cancellationToken);
            if (count == 0)
            {
                return builder.ToString();
            }

            bytes += System.Text.Encoding.UTF8.GetByteCount(buffer, 0, count);
            if (bytes > MaxResponseBytes)
            {
                throw new InvalidOperationException(
                    $"Response exceeded the {MaxResponseBytes}-byte limit."
                );
            }

            builder.Append(buffer, 0, count);
        }
    }

    private static string FormatContent(string content, string? mediaType, string format)
    {
        var normalizedFormat = format.Trim().ToLowerInvariant();
        return normalizedFormat switch
        {
            "raw" => content,
            "text" => NormalizeLineEndings(content),
            "markdown"
                when string.Equals(mediaType, "text/html", StringComparison.OrdinalIgnoreCase) =>
                HtmlToMarkdown(content),
            "markdown" => NormalizeLineEndings(content),
            "readable"
                when string.Equals(mediaType, "text/html", StringComparison.OrdinalIgnoreCase) =>
                HtmlToReadableText(content),
            "readable" => NormalizeLineEndings(content),
            _ => throw new ArgumentException(
                "format must be one of: raw, text, markdown, readable.",
                nameof(format)
            ),
        };
    }

    private static void ValidateFormat(string format)
    {
        if (format.Trim().ToLowerInvariant() is not ("raw" or "text" or "markdown" or "readable"))
        {
            throw new ArgumentException(
                "format must be one of: raw, text, markdown, readable.",
                nameof(format)
            );
        }
    }

    private static string HtmlToReadableText(string html)
    {
        var withoutComments = HtmlCommentPattern.Replace(html, string.Empty);
        var withoutNonContent = HtmlNonContentPattern.Replace(withoutComments, string.Empty);
        var withLineBreaks = Regex.Replace(
            withoutNonContent,
            @"</?(p|div|article|section|main|header|footer|h[1-6]|li|br)\b[^>]*>",
            Environment.NewLine,
            RegexOptions.IgnoreCase
        );
        var withoutTags = HtmlTagPattern.Replace(withLineBreaks, string.Empty);
        var decoded = WebUtility.HtmlDecode(withoutTags);
        var lines = decoded
            .Split('\n')
            .Select(line => WhitespacePattern.Replace(line, " ").Trim())
            .Where(line => line.Length > 0);

        return string.Join(Environment.NewLine, lines);
    }

    private static string HtmlToMarkdown(string html)
    {
        var withoutComments = HtmlCommentPattern.Replace(html, string.Empty);
        var withoutNonContent = HtmlNonContentPattern.Replace(withoutComments, string.Empty);
        var markdown = HtmlHeadingPattern.Replace(
            withoutNonContent,
            match =>
                $"{new string('#', int.Parse(match.Groups[1].Value))} {StripHtml(match.Groups[2].Value)}\n\n"
        );
        markdown = HtmlLinkPattern.Replace(
            markdown,
            match => $"[{StripHtml(match.Groups[2].Value)}]({match.Groups[1].Value})"
        );
        markdown = HtmlListItemPattern.Replace(
            markdown,
            match => $"- {StripHtml(match.Groups[1].Value)}\n"
        );
        markdown = Regex.Replace(
            markdown,
            @"</?(p|div|article|section|main|header|footer|br)\b[^>]*>",
            "\n\n",
            RegexOptions.IgnoreCase
        );
        markdown = HtmlTagPattern.Replace(markdown, string.Empty);
        markdown = WebUtility.HtmlDecode(markdown);
        markdown = NormalizeLineEndings(markdown);
        markdown = Regex.Replace(markdown, @"[ \t]+", " ");
        markdown = Regex.Replace(markdown, @"\n{3,}", "\n\n");
        return markdown.Trim();
    }

    private static string StripHtml(string value) =>
        WebUtility.HtmlDecode(HtmlTagPattern.Replace(value, string.Empty)).Trim();

    private static string NormalizeLineEndings(string content) =>
        content.Replace("\r\n", "\n").Replace('\r', '\n');

    private static void ValidateUri(Uri uri)
    {
        if (uri.Scheme is not ("http" or "https") || !string.IsNullOrWhiteSpace(uri.UserInfo))
        {
            throw new ArgumentException(
                "Only public HTTP or HTTPS URLs without credentials are allowed.",
                nameof(uri)
            );
        }

        if (
            uri.IsLoopback
            || string.Equals(uri.Host, "localhost", StringComparison.OrdinalIgnoreCase)
        )
        {
            throw new ArgumentException("Local URLs are not allowed.", nameof(uri));
        }

        if (IPAddress.TryParse(uri.Host, out var address) && IsPrivateAddress(address))
        {
            throw new ArgumentException(
                "Private and local network addresses are not allowed.",
                nameof(uri)
            );
        }
    }

    private static bool IsPrivateAddress(IPAddress address)
    {
        if (address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
        {
            var bytes = address.GetAddressBytes();
            return bytes[0] == 10
                || (bytes[0] == 172 && bytes[1] is >= 16 and <= 31)
                || (bytes[0] == 192 && bytes[1] == 168)
                || bytes[0] == 127
                || (bytes[0] == 169 && bytes[1] == 254)
                || bytes[0] == 0;
        }

        return address.IsIPv6LinkLocal
            || address.IsIPv6SiteLocal
            || address.Equals(IPAddress.IPv6Loopback)
            || address.Equals(IPAddress.IPv6Any);
    }

    private static bool IsRedirect(HttpStatusCode statusCode) =>
        statusCode
            is HttpStatusCode.MovedPermanently
                or HttpStatusCode.Found
                or HttpStatusCode.SeeOther
                or HttpStatusCode.TemporaryRedirect
                or HttpStatusCode.PermanentRedirect;
}
