using AgentSkillsMcp.Search;

var builder = WebApplication.CreateBuilder(args);

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

builder
    .Services.AddMcpServer()
    .WithHttpTransport(options =>
    {
        options.Stateless = true;
    })
    .WithTools<FetchTools>()
    .WithTools<CrawlTools>()
    .WithTools<SearchTools>()
    .WithTools<LlmTextTools>()
    .WithTools<ResearchTools>();

var app = builder.Build();
app.MapMcp();

app.Run();

public partial class SearchProgram { }
