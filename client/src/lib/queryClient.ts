import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getSupabaseClient } from "./supabaseClient";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const supabase = await getSupabaseClient();
  
  // Helper to make the request with current session
  const makeRequest = async (): Promise<Response> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    const headers: HeadersInit = data ? { "Content-Type": "application/json" } : {};
    
    // Add Authorization header if user is authenticated
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }

    return await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
  };

  // Try the request
  let res = await makeRequest();

  // If 401, try to refresh session once and retry
  if (res.status === 401) {
    try {
      const { data: { session: refreshedSession }, error } = await supabase.auth.refreshSession();
      
      if (!error && refreshedSession) {
        // Retry with refreshed session
        res = await makeRequest();
      }
    } catch (refreshError) {
      console.error("Session refresh failed:", refreshError);
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const supabase = await getSupabaseClient();
    
    // Helper to make the request with current session
    const makeRequest = async (): Promise<Response> => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: HeadersInit = {};
      
      // Add Authorization header if user is authenticated
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      return await fetch(queryKey.join("/") as string, {
        credentials: "include",
        headers,
      });
    };

    // Try the request
    let res = await makeRequest();

    // If 401, ALWAYS try to refresh session once and retry (regardless of on401 mode)
    if (res.status === 401) {
      try {
        const { data: { session: refreshedSession }, error } = await supabase.auth.refreshSession();
        
        if (!error && refreshedSession) {
          // Retry with refreshed session
          res = await makeRequest();
        }
      } catch (refreshError) {
        console.error("Session refresh failed:", refreshError);
      }
      
      // After retry attempt, apply the on401 behavior
      if (res.status === 401) {
        if (unauthorizedBehavior === "returnNull") {
          return null;
        }
        // For "throw", let throwIfResNotOk handle it below
      }
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
