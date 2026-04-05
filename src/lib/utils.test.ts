import {
  formatProbabilityPercent,
  getTokenColorClass,
} from "@/lib/utils";

describe("token color utilities", () => {
  it("maps absolute probability buckets from the legend", () => {
    expect(getTokenColorClass(1)).toBe("token-high-prob");
    expect(getTokenColorClass(0.9999)).toBe("token-high-prob");
    expect(getTokenColorClass(0.7499)).toBe("token-med-high-prob");
    expect(getTokenColorClass(0.5)).toBe("token-med-high-prob");
    expect(getTokenColorClass(0.4999)).toBe("token-med-low-prob");
    expect(getTokenColorClass(0.25)).toBe("token-med-low-prob");
    expect(getTokenColorClass(0.2499)).toBe("token-low-prob");
  });

  it("formats percentages by rounding down so sub-1.0 probabilities never display as 100.00%", () => {
    expect(formatProbabilityPercent(1)).toBe("100.00%");
    expect(formatProbabilityPercent(0.999999)).toBe("99.99%");
    expect(formatProbabilityPercent(0.99000003)).toBe("99.00%");
    expect(formatProbabilityPercent(0.000001)).toBe("< 0.01%");
  });
});
