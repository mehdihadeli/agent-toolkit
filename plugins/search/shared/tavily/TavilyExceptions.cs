using System.Text.Json;

namespace AgentSkillsMcp.Tavily;

public class TavilyException : Exception
{
    public TavilyException(string message, Exception? innerException = null)
        : base(message, innerException) { }
}

public class UsageLimitExceededException : TavilyException
{
    public UsageLimitExceededException(string message)
        : base(message) { }
}

public sealed class TavilyKeylessLimitException : UsageLimitExceededException
{
    public TavilyKeylessLimitException(
        string message,
        string? code = null,
        string? window = null,
        int? retryAfterSeconds = null,
        IReadOnlyList<JsonElement>? nextActions = null
    )
        : base(message)
    {
        Code = code;
        Window = window;
        RetryAfterSeconds = retryAfterSeconds;
        NextActions = nextActions ?? [];
    }

    public string? Code { get; }
    public string? Window { get; }
    public int? RetryAfterSeconds { get; }
    public IReadOnlyList<JsonElement> NextActions { get; }
}

public sealed class BadRequestException : TavilyException
{
    public BadRequestException(string message)
        : base(message) { }
}

public sealed class ForbiddenException : TavilyException
{
    public ForbiddenException(string message)
        : base(message) { }
}

public sealed class InvalidApiKeyException : TavilyException
{
    public InvalidApiKeyException(string message)
        : base(message) { }
}

public sealed class TavilyTimeoutException : TavilyException
{
    public TavilyTimeoutException(TimeSpan timeout)
        : base($"Request timed out after {timeout.TotalSeconds:0.###} seconds.") { }
}

public sealed class MissingApiKeyException : ArgumentException
{
    public MissingApiKeyException()
        : base("No API key provided. Please provide the apiKey argument.", "apiKey") { }
}

public sealed class KeylessUnsupportedEndpointException : TavilyException
{
    public KeylessUnsupportedEndpointException(string method)
        : base(
            $"`{method}` is not available in keyless mode. Only `search` and `extract` "
                + "can be called without an API key."
        )
    {
        Method = method;
    }

    public string Method { get; }
}
