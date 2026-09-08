using System.ComponentModel;
using System.Text;
using Microsoft.Extensions.AI;
using ModelContextProtocol.Server;
using OpenAI;

namespace AgentSkillsMcp.Search;

public sealed class ResearchTools(ResearchService researchService)
{
    [McpServerTool(Name = "research")]
    [Description("Research a question with web search and return cited AI-readable Markdown.")]
    public Task<string> ResearchAsync(
        [Description("Research question to investigate.")] string question,
        [Description("Maximum search results to inspect, from 1 to 10.")] int max_results = 5,
        CancellationToken cancellationToken = default
    ) => researchService.ResearchAsync(question, max_results, cancellationToken);
}

public sealed class ResearchService(SearchTools searchTools)
{
    public async Task<string> ResearchAsync(
        string question,
        int maxResults,
        CancellationToken cancellationToken
    )
    {
        if (string.IsNullOrWhiteSpace(question))
        {
            throw new ArgumentException("question cannot be empty.", nameof(question));
        }

        if (maxResults is < 1 or > 10)
        {
            throw new ArgumentOutOfRangeException(
                nameof(maxResults),
                "max_results must be between 1 and 10."
            );
        }

        var dossier = await searchTools.SearchAsync(
            question,
            Environment.GetEnvironmentVariable("SEARCH_PROVIDER") ?? "tavily",
            maxResults,
            fetch_results: true,
            cancellationToken
        );
        var apiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY");
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return FormatReport(question, dossier, "Source dossier");
        }

        var model = Environment.GetEnvironmentVariable("OPENAI_MODEL") ?? "gpt-4o-mini";
        var chatClient = new OpenAIClient(apiKey).GetChatClient(model).AsIChatClient();
        var agent = new Microsoft.Agents.AI.ChatClientAgent(
            chatClient,
            instructions: "You are a rigorous research analyst. Use only supplied source material. "
                + "Return concise Markdown with claims, inline source links, uncertainty, and a Sources section."
        );
        var response = await agent.RunAsync(
            $"Research question: {question}\n\nSource dossier:\n{dossier}",
            cancellationToken: cancellationToken
        );
        return FormatReport(question, response.Text, "Research report");
    }

    private static string FormatReport(string question, string content, string heading)
    {
        var output = new StringBuilder();
        output.AppendLine($"# {heading}: {question}");
        output.AppendLine();
        output.AppendLine(content.Trim());
        return output.ToString().TrimEnd();
    }
}
