"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

interface MenuItem {
  name: string;
  price: string;
  category: string;
  description: string;
  isVeg: boolean;
}

export const analyzeMenuPhoto = action({
  args: {
    imageBase64: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY not configured. Add it in Settings → Keys.");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a menu OCR assistant. Analyze the menu image and extract ALL menu items.

For each item, extract:
- name: The dish/item name
- price: The price as a plain number (remove ₹, $, commas, dots for thousands). Example: "₹1,299" → "1299", "$12.99" → "12.99", "Rs. 250" → "250"
- category: Infer a category (e.g., "Starters", "Main Course", "Beverages", "Desserts", "Snacks", "Breads", "Rice", "Chinese", "South Indian", etc.)
- description: Brief description if visible, otherwise empty string
- isVeg: true if vegetarian (green dot indicator or vegetarian item), false otherwise

Return ONLY a valid JSON array. No markdown, no explanation. Example:
[{"name":"Masala Chai","price":"30","category":"Beverages","description":"","isVeg":true},{"name":"Chicken Biryani","price":"180","category":"Main Course","description":"Aromatic basmati rice","isVeg":false}]`,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${args.imageBase64}`,
                  detail: "high",
                },
              },
              {
                type: "text",
                text: "Extract all menu items from this menu image. Return a JSON array with name, price, category, description, and isVeg for each item.",
              },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errBody}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "[]";

    // Extract JSON array from response (handle markdown code blocks)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("Could not parse menu items from image. Please try a clearer photo.");
    }

    const items: MenuItem[] = JSON.parse(jsonMatch[0]);

    // Validate and clean items
    return items
      .filter((item) => item.name && item.price)
      .map((item) => ({
        name: String(item.name).trim(),
        price: String(item.price).replace(/[₹$€£,\s]/g, ""),
        category: String(item.category || "Other").trim(),
        description: String(item.description || "").trim(),
        isVeg: Boolean(item.isVeg),
      }));
  },
});
