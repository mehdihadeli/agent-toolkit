using AgentSkillsMcp.Search;

var explicitHttpTransport =
    args.Any(argument =>
        string.Equals(argument, "--http", StringComparison.OrdinalIgnoreCase)
        || string.Equals(argument, "--transport=http", StringComparison.OrdinalIgnoreCase)
    )
    || args.Select((argument, index) => (argument, index))
        .Any(item =>
            string.Equals(item.argument, "--transport", StringComparison.OrdinalIgnoreCase)
            && item.index + 1 < args.Length
            && string.Equals(args[item.index + 1], "http", StringComparison.OrdinalIgnoreCase)
        );
var explicitStdioTransport =
    args.Any(argument =>
        string.Equals(argument, "--transport=stdio", StringComparison.OrdinalIgnoreCase)
    )
    || args.Select((argument, index) => (argument, index))
        .Any(item =>
            string.Equals(item.argument, "--transport", StringComparison.OrdinalIgnoreCase)
            && item.index + 1 < args.Length
            && string.Equals(args[item.index + 1], "stdio", StringComparison.OrdinalIgnoreCase)
        );
var useHttpTransport =
    explicitHttpTransport
    || (
        !explicitStdioTransport
        && string.Equals(
            Environment.GetEnvironmentVariable("Search__Transport"),
            "http",
            StringComparison.OrdinalIgnoreCase
        )
    );

WebApplicationBuilder? webBuilder = null;
HostApplicationBuilder? hostBuilder = null;
IHostApplicationBuilder builder;

if (useHttpTransport)
{
    webBuilder = WebApplication.CreateBuilder(args);
    builder = webBuilder;
}
else
{
    hostBuilder = Host.CreateApplicationBuilder(args);
    builder = hostBuilder;
}

builder.Services.Configure<SearchOptions>(options =>
{
    builder.Configuration.GetSection("Search").Bind(options);
    options.TavilyApiKey ??= builder.Configuration["TAVILY_API_KEY"];
});

builder
    .Services.AddHttpClient(
        "fetch",
        client =>
        {
            client.Timeout = TimeSpan.FromSeconds(30);
            client.DefaultRequestHeaders.UserAgent.ParseAdd("AgentSkillsMcp.Search/1.0");
        }
    )
    .ConfigurePrimaryHttpMessageHandler(
        () =>
            new HttpClientHandler
            {
                AllowAutoRedirect = false,
                AutomaticDecompression = System.Net.DecompressionMethods.All,
            }
    );

builder.Services.AddHttpClient("tavily", client => client.Timeout = TimeSpan.FromSeconds(30));

var mcpBuilder = builder
    .Services.AddMcpServer()
    .WithTools<FetchTools>()
    .WithTools<CrawlTools>()
    .WithTools<SearchTools>()
    .WithTools<LlmTextTools>()
    .WithTools<ResearchTools>();

if (useHttpTransport)
{
    mcpBuilder.WithHttpTransport(options => options.Stateless = true);
    var app = webBuilder!.Build();
    app.MapMcp();
    app.Run();
}
else
{
    mcpBuilder.WithStdioServerTransport();
    await hostBuilder!.Build().RunAsync();
}

public partial class SearchProgram { }
