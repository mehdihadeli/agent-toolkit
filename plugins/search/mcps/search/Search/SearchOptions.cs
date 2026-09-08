public sealed class SearchOptions
{
    public string? TavilyApiKey { get; set; }
    public string? BingApiKey { get; set; }
    public string TavilyEndpoint { get; set; } = "https://api.tavily.com/search";
    public string BingEndpoint { get; set; } = "https://api.bing.microsoft.com/v7.0/search";
}
