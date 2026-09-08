using AgentSkillsMcp.DotnetQualityAgent;
using Shouldly;
using Xunit;

public sealed class TechnicalDebtTests
{
    [Fact]
    public void BuildArguments_uses_verify_mode_and_warning_severity()
    {
        var arguments = DotnetFormatRunner.BuildArguments(
            "C:\\workspace",
            FormatScope.Style,
            verifyOnly: true,
            "report.json"
        );

        arguments.ShouldContain("format");
        arguments.ShouldContain("style");
        arguments.ShouldContain("--verify-no-changes");
        arguments.ShouldContain("--severity");
        arguments.ShouldContain("warn");
    }
}
