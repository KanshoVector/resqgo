import { z } from "zod";

const finiteLatitude = z
  .number()
  .finite()
  .min(-90)
  .max(90);

const finiteLongitude = z
  .number()
  .finite()
  .min(-180)
  .max(180);

export const prioritySchema = z.enum(["high", "medium", "low"]);

export const shelterStatusSchema = z.enum(["open", "full", "closed"]);

export const emergencyInputSchema = z.object({
  title: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  lat: finiteLatitude,
  lng: finiteLongitude,
  contact_info: z.string().max(200).optional(),
  priority: prioritySchema.default("medium"),
});

export const searchSchema = z.object({
  lat: finiteLatitude,
  lng: finiteLongitude,
  radiusMeters: z.number().min(100).max(50000).default(5000),
  priority: prioritySchema.optional(),
  shelterStatus: shelterStatusSchema.optional(),
});

export type EmergencyInput = z.infer<typeof emergencyInputSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
