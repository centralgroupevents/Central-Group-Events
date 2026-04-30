import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";

// --- Types inferred from the schema ---
type Event = z.infer<typeof api.events.list.responses[200]>[0];
type InsertSubscriber = z.infer<typeof api.subscribers.create.input>;
type InsertBooking = z.infer<typeof api.bookings.create.input>;

export function useEvents(region?: string) {
  return useQuery({
    queryKey: [api.events.list.path, region],
    queryFn: async () => {
      const url = new URL(api.events.list.path, window.location.origin);
      if (region && region !== "All") {
        url.searchParams.append("region", region);
      }
      
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch events");
      
      // Parse with the Zod schema from the API contract
      return api.events.list.responses[200].parse(await res.json());
    },
  });
}

export function useSubscribeNewsletter() {
  return useMutation({
    mutationFn: async (data: InsertSubscriber) => {
      const validated = api.subscribers.create.input.parse(data);
      const res = await fetch(api.subscribers.create.path, {
        method: api.subscribers.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.subscribers.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to subscribe");
      }
      
      return api.subscribers.create.responses[201].parse(await res.json());
    },
  });
}

export function useCreateBooking() {
  return useMutation({
    mutationFn: async (data: InsertBooking) => {
      const validated = api.bookings.create.input.parse(data);
      const res = await fetch(api.bookings.create.path, {
        method: api.bookings.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.bookings.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to submit booking");
      }
      
      return api.bookings.create.responses[201].parse(await res.json());
    },
  });
}
