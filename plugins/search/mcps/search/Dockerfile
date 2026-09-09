FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG TARGETARCH
WORKDIR /source

# Restore dependencies in a cache-friendly layer.
COPY --link AgentSkillsMcp.Search.csproj .
RUN dotnet restore -a $TARGETARCH

# Publish application after source changes.
COPY --link . .
RUN dotnet publish -a $TARGETARCH -c Release --no-restore -o /app/publish --no-self-contained

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --link --from=build /app/publish .
USER $APP_UID
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "AgentSkillsMcp.Search.dll", "--http"]