"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

// ─── Configuration ──────────────────────────────────────────
const GEMINI_MODEL = "gemini-2.5-flash-lite";

interface ExtractedMenuItem {
  name: string;
  price: number | null;
  category: string;
  isVeg: boolean | null;
  description: string | null;
}

interface GeminiResponse {
  items: ExtractedMenuItem[];
}

// ─── Extraction Prompt ──────────────────────────────────────
const MENU_EXTRACTION_PROMPT = `You are an expert restaurant menu digitization system.

Analyze the provided menu image carefully.

Extract EVERY visible menu item.

For each item extract:
- name
- price
- category
- isVeg
- description

Price handling:
Understand these formats and convert to numeric values:
₹220 → 220
Rs. 220 → 220
Rs 220 → 220
220/- → 220
₹1,299 → 1299
1,299 → 1299
$12 → 12
$12.99 → 12.99

Do not invent prices. If the price cannot be determined, return null.

For vegetarian status:
Look for vegetarian/non-vegetarian symbols or indicators next to the item.
Green vegetarian symbols commonly indicate vegetarian.
Red/non-vegetarian symbols commonly indicate non-vegetarian.
Do not blindly assume the color if the symbol/context indicates otherwise.
If vegetarian status cannot be determined confidently, return null.

For descriptions:
Only return descriptions that are actually visible in the menu.
Never invent descriptions. If no description is visible, return null.

Categories should be taken from the menu when possible.
If a category is not explicitly visible, infer a reasonable category such as:
Starters, Main Course, Breads, Rice, Desserts, Beverages, Soups, Salads, Sides, Snacks, Chinese, South Indian, Other

Ignore:
- restaurant address
- phone numbers
- opening hours
- advertisements
- promotional text
- website URLs
- unrelated text

Extract ALL visible menu items.

Return ONLY valid JSON in this exact format:
{
  "items": [
    {
      "name": "Item Name",
      "price": 220,
      "category": "Category",
      "isVeg": true,
      "description": "Description text or null"
    }
  ]
}

Do not return markdown. Do not return explanations. Only return the JSON object.`;

// ─── Validation ─────────────────────────────────────────────
function validateAndNormalizeItems(raw: unknown): ExtractedMenuItem[] {
  if (!raw || typeof raw !== "object") return [];
  
  const data = raw as Record<string, unknown>;
  const items = data.items;
  
  if (!Array.isArray(items)) return [];
  
  return items
    .filter((item): item is Record<string, unknown> => {
      if (!item || typeof item !== "object") return false;
      const i = item as Record<string, unknown>;
      return typeof i.name === "string" && i.name.trim().length > 0;
    })
    .map((item) => {
      const i = item as Record<string, unknown>;
      
      // Normalize price
      let price: number | null = null;
      if (typeof i.price === "number" && !isNaN(i.price) && i.price > 0) {
        price = Math.round(i.price * 100) / 100;
      } else if (typeof i.price === "string") {
        const cleaned = (i.price as string).replace(/[₹$€£,\s]/g, "");
        const parsed = parseFloat(cleaned);
        if (!isNaN(parsed) && parsed > 0) {
          price = Math.round(parsed * 100) / 100;
        }
      }
      
      // Normalize isVeg
      let isVeg: boolean | null = null;
      if (typeof i.isVeg === "boolean") {
        isVeg = i.isVeg;
      } else if (i.isVeg === null || i.isVeg === undefined) {
        isVeg = null;
      }
      
      // Normalize description
      let description: string | null = null;
      if (typeof i.description === "string" && i.description.trim().length > 0) {
        description = i.description.trim();
      }
      
      // Normalize category
      let category = "Other";
      if (typeof i.category === "string" && i.category.trim().length > 0) {
        category = i.category.trim();
      }
      
      return {
        name: String(i.name).trim(),
        price,
        category,
        isVeg,
        description,
      };
    });
}

// ─── Main Action ────────────────────────────────────────────
export const analyzeMenuPhoto = action({
  args: {
    imageBase64: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Gemini AI is not configured. Please add GEMINI_API_KEY in Convex environment variables.",
      );
    }

    // Validate base64 image
    if (!args.imageBase64 || args.imageBase64.length < 100) {
      throw new Error(
        "Unable to read the uploaded menu image. Please try uploading the image again.",
      );
    }

    try {
      // Call Gemini API
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: args.imageBase64,
                  },
                },
                {
                  text: MENU_EXTRACTION_PROMPT,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error("Gemini API error:", response.status, errBody);
        throw new Error(
          "AI analysis failed. Please try again.",
        );
      }

      const data = await response.json();
      
      // Extract text from Gemini response
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      
      if (!text) {
        throw new Error(
          "AI could not analyze the image. Please try a clearer photo.",
        );
      }

      // Parse JSON from response (handle potential markdown code blocks)
      let parsed: unknown;
      try {
        // Try direct parse first
        parsed = JSON.parse(text);
      } catch {
        // Try to extract JSON from markdown code block
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1]);
        } else {
          // Try to find JSON object
          const objectMatch = text.match(/\{[\s\S]*\}/);
          if (objectMatch) {
            parsed = JSON.parse(objectMatch[0]);
          } else {
            throw new Error("Could not parse menu items from image.");
          }
        }
      }

      // Validate and normalize
      const items = validateAndNormalizeItems(parsed);
      
      if (items.length === 0) {
        throw new Error(
          "No menu items found in the photo. Please try a clearer image with visible menu items.",
        );
      }

      return items;
    } catch (error: unknown) {
      // Re-throw known errors
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("AI analysis failed. Please try again.");
    }
  },
});
