import { calculate } from "./apiClient";
import { safeFetch, apiPath, ensureHealthy } from "./apiDiscovery";

jest.mock("./apiDiscovery", () => ({
  safeFetch: jest.fn(),
  apiPath: jest.fn((path) => `https://mocked-api.com${path}`),
  ensureHealthy: jest.fn(),
}));

describe("apiClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should call the API and return the result on success", async () => {
    const mockPayload = { key: "value" };
    const mockResponse = { result: "success" };

    safeFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await calculate(mockPayload);

    expect(ensureHealthy).toHaveBeenCalled();
    expect(apiPath).toHaveBeenCalledWith("/calculate");
    expect(safeFetch).toHaveBeenCalledWith("https://mocked-api.com/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockPayload),
    });
    expect(result).toEqual(mockResponse);
  });

  it("should throw an error if the API call fails", async () => {
    const mockPayload = { key: "value" };

    safeFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    await expect(calculate(mockPayload)).rejects.toThrow("API 500 Internal Server Error");

    expect(ensureHealthy).toHaveBeenCalled();
    expect(apiPath).toHaveBeenCalledWith("/calculate");
    expect(safeFetch).toHaveBeenCalledWith("https://mocked-api.com/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockPayload),
    });
  });
});
