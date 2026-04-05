import { renderToStaticMarkup } from "react-dom/server";

import { TokenText } from "@/components/TokenText";

describe("TokenText", () => {
  it("scopes rendered token selectors to the active completion", () => {
    const markup = renderToStaticMarkup(
      <TokenText
        tokens={[
          {
            index: 7,
            token: "hello",
            logprob: -0.2,
            prob: Math.exp(-0.2),
            top_logprobs: [],
          },
        ]}
        onTokenClick={() => undefined}
        tokenScopeId="message-42"
      />,
    );

    expect(markup).toContain('data-token-index="7"');
    expect(markup).toContain('data-token-scope="message-42"');
  });

  it("renders historical tokens as non-interactive", () => {
    const markup = renderToStaticMarkup(
      <TokenText
        tokens={[
          {
            index: 0,
            token: "old",
            logprob: -0.1,
            prob: Math.exp(-0.1),
            top_logprobs: [],
          },
        ]}
        onTokenClick={() => undefined}
        tokenScopeId="message-1"
        isInteractive={false}
      />,
    );

    expect(markup).not.toContain('role="button"');
    expect(markup).not.toContain("tabindex");
  });

  it("renders every token in long completions", () => {
    const tokens = Array.from({ length: 250 }, (_, index) => ({
      index,
      token: `t${index}`,
      logprob: -0.1,
      prob: 0.9,
      top_logprobs: [],
    }));

    const markup = renderToStaticMarkup(
      <TokenText
        tokens={tokens}
        onTokenClick={() => undefined}
        tokenScopeId="message-99"
      />,
    );

    expect(markup).toContain('data-token-index="249"');
  });

  it("applies the highlighted state declaratively", () => {
    const markup = renderToStaticMarkup(
      <TokenText
        tokens={[
          {
            index: 3,
            token: "focus",
            logprob: -0.1,
            prob: 0.9,
            top_logprobs: [],
          },
        ]}
        onTokenClick={() => undefined}
        tokenScopeId="message-3"
        highlightedTokenIndex={3}
      />,
    );

    expect(markup).toContain("token-highlighted");
  });
});
