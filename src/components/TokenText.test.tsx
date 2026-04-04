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
});
