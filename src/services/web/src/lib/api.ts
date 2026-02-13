/**
 * API client for LLM Loadtest backend.
 */

export const API_BASE = "/api/v1/benchmark";

// ============================================================
// Framework Types (v1.1)
// ============================================================

export type FrameworkType = "vllm" | "sglang" | "ollama" | "triton";

export interface GoodputThresholds {
  ttft_ms?: number;
  tpot_ms?: number;
  e2e_ms?: number;
}

export interface VLLMConfig {
  gpu_memory_utilization?: number;
  tensor_parallel_size?: number;
  max_num_seqs?: number;
  quantization?: string;
}

export interface SGLangConfig {
  tensor_parallel_size?: number;
  chunked_prefill?: boolean;
  mem_fraction_static?: number;
}

export interface OllamaConfig {
  context_length?: number;
  num_gpu?: number;
}

export interface TritonConfig {
  backend?: string;
  instance_count?: number;
}

export type FrameworkConfig = VLLMConfig | SGLangConfig | OllamaConfig | TritonConfig;

export interface ValidationConfig {
  enabled: boolean;
  docker_enabled?: boolean;  // Docker deployment (default: true)
  container_name?: string;
  tolerance?: number;
}

export interface MetricComparison {
  metric_name: string;
  client_value: number;
  server_value: number;
  difference_percent: number;
  passed: boolean;
}

export interface DockerLogMetrics {
  http_200_count: number;
  http_error_count: number;
  avg_prompt_throughput: number;
  avg_generation_throughput: number;
  peak_kv_cache_usage: number;
  prefix_cache_hit_rate: number;
  error_messages: string[];
  warning_messages: string[];
  total_log_lines: number;
  container_name?: string;
}

export interface DockerLogValidation {
  passed: boolean;
  http_request_match: boolean;
  throughput_match: boolean;
  has_errors: boolean;
  comparisons: MetricComparison[];
  warnings: string[];
  docker_metrics?: DockerLogMetrics;
}

export interface PrometheusValidation {
  passed: boolean;
  comparisons: MetricComparison[];
  warnings: string[];
}

export interface ValidationResult {
  overall_passed: boolean;
  tolerance: number;
  prometheus_validation?: PrometheusValidation;
  prometheus_available: boolean;
  docker_log_validation?: DockerLogValidation;
  docker_available: boolean;
  all_comparisons: MetricComparison[];
  all_warnings: string[];
  validated_at?: string;
}

export interface BenchmarkConfig {
  server_url: string;
  model: string;
  adapter: string;
  concurrency: number[];
  num_prompts: number;
  input_len: number;
  output_len: number;
  stream: boolean;
  warmup: number;
  timeout: number;
  api_key?: string;
  duration_seconds?: number;
  goodput_thresholds?: GoodputThresholds;
  // v1.1: Framework selection
  framework?: FrameworkType;
  framework_config?: FrameworkConfig;
  // Deprecated: use framework_config instead
  vllm_config?: VLLMConfig;
  validation_config?: ValidationConfig;
}

export interface BenchmarkStatus {
  run_id: string;
  status: string;
  server_url: string;
  model: string;
  adapter: string;
  framework?: FrameworkType;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface LatencyStats {
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface GoodputResult {
  satisfied_requests: number;
  total_requests: number;
  goodput_percent: number;
}

export interface ConcurrencyResult {
  concurrency: number;
  ttft: LatencyStats;
  tpot?: LatencyStats;
  e2e_latency: LatencyStats;
  throughput_tokens_per_sec: number;
  request_rate_per_sec: number;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  error_rate_percent: number;
  goodput?: GoodputResult;
}

export interface BenchmarkResult {
  run_id: string;
  server_url: string;
  model: string;
  adapter: string;
  framework?: FrameworkType;
  framework_config?: FrameworkConfig;
  results: ConcurrencyResult[];
  summary: {
    best_throughput: number;
    best_ttft_p50: number;
    best_concurrency: number;
    total_requests: number;
    overall_error_rate: number;
    avg_goodput_percent?: number;
  };
  started_at: string;
  completed_at: string;
  duration_seconds: number;
  validation?: ValidationResult;
}

export interface RunListResponse {
  runs: BenchmarkStatus[];
  total: number;
  limit: number;
  offset: number;
}

export interface ComparisonMetric {
  run_id: string;
  value: number;
  concurrency?: number;
}

export interface ComparisonResult {
  run_count: number;
  best_throughput: ComparisonMetric;
  best_ttft: ComparisonMetric;
  by_concurrency: Record<string, unknown>;
}

class ApiClient {
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Health check
  async health(): Promise<{ status: string; version: string }> {
    return this.request<{ status: string; version: string }>("/health");
  }

  // Start benchmark
  async startBenchmark(config: BenchmarkConfig): Promise<{ run_id: string; status: string }> {
    return this.request<{ run_id: string; status: string }>("/run", {
      method: "POST",
      body: JSON.stringify(config),
    });
  }

  // Get run status
  async getRunStatus(runId: string): Promise<BenchmarkStatus> {
    return this.request<BenchmarkStatus>(`/run/${runId}`);
  }

  // Get result
  async getResult(runId: string): Promise<BenchmarkResult> {
    return this.request<BenchmarkResult>(`/result/${runId}`);
  }

  // List runs
  async listRuns(params?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<RunListResponse> {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.offset) query.set("offset", String(params.offset));
    if (params?.status) query.set("status", params.status);

    return this.request<RunListResponse>(`/history?${query.toString()}`);
  }

  // Stop a running benchmark
  async stopBenchmark(runId: string): Promise<{ run_id: string; status: string }> {
    return this.request<{ run_id: string; status: string }>(`/run/${runId}/stop`, {
      method: "POST",
    });
  }

  // Delete run
  async deleteRun(runId: string): Promise<void> {
    await this.request(`/run/${runId}`, { method: "DELETE" });
  }

  // Compare runs
  async compareRuns(runIds: string[]): Promise<{ comparison: ComparisonResult }> {
    return this.request<{ comparison: ComparisonResult }>("/compare", {
      method: "POST",
      body: JSON.stringify({ run_ids: runIds }),
    });
  }
}

// ============================================================
// Phase 5: Infrastructure Recommendation Types
// ============================================================

export interface WorkloadSpec {
  peak_concurrency: number;
  daily_active_users?: number;
  requests_per_user_per_day?: number;
  avg_input_tokens?: number;
  avg_output_tokens?: number;
  ttft_target_ms?: number;
  tpot_target_ms?: number;
  goodput_target_percent?: number;
}

export interface TestConfig {
  concurrency_steps?: number[];
  num_requests_per_step?: number;
}

export interface RecommendRequest {
  server_url: string;
  model: string;
  adapter?: string;
  workload: WorkloadSpec;
  headroom_percent?: number;
  test_config?: TestConfig;
  stream?: boolean;
  warmup?: number;
  timeout?: number;
  api_key?: string;
}

export interface InfraProfile {
  gpu_model: string;
  gpu_count: number;
  gpu_memory_gb: number;
  max_concurrency_at_slo: number;
  throughput_tokens_per_sec: number;
  goodput_at_max_concurrency: number;
  saturation_concurrency: number;
  saturation_goodput: number;
}

export interface InfraRecommendation {
  model_name: string;
  recommended_gpu: string;
  recommended_count: number;
  tensor_parallelism: number;
  estimated_max_concurrency: number;
  estimated_goodput: number;
  estimated_throughput: number;
  headroom_percent: number;
  calculation_formula: string;
  reasoning: string;
  estimated_monthly_cost_usd?: number;
}

export interface RecommendStatus {
  run_id: string;
  status: string;
  server_url: string;
  model: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

export interface RecommendResponse {
  run_id: string;
  recommendation: InfraRecommendation;
  current_infra: InfraProfile;
  workload: WorkloadSpec;
  test_results: ConcurrencyResult[];
  started_at: string;
  completed_at: string;
  duration_seconds: number;
}

export const api = new ApiClient();

// Recommendation API methods (separate from main client for clarity)
export const recommendApi = {
  // Start recommendation
  async startRecommend(request: RecommendRequest): Promise<{ run_id: string; status: string }> {
    const response = await fetch(`${API_BASE}/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    return response.json();
  },

  // Get recommendation status
  async getStatus(runId: string): Promise<RecommendStatus> {
    const response = await fetch(`${API_BASE}/recommend/${runId}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    return response.json();
  },

  // Get recommendation result
  async getResult(runId: string): Promise<RecommendResponse> {
    const response = await fetch(`${API_BASE}/recommend/${runId}/result`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    return response.json();
  },

  // Delete recommendation
  async deleteRecommend(runId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/recommend/${runId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
  },
};
